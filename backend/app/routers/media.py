import json
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models.session import InterviewSession
from app.models.user import User
from app.ratelimit import limiter
from app.security import get_current_user
from app.services import interview, session_media

router = APIRouter(prefix="/interview", tags=["interview-media"])

# Fallback map when the upload has no filename extension to read the container from.
_SUBTYPE_EXT = {"webm": "webm", "mp4": "mp4", "ogg": "ogg", "quicktime": "mov", "x-matroska": "mkv"}


def _owned(db: Session, session_id: int, user: User) -> InterviewSession:
    session = db.get(InterviewSession, session_id)
    if session is None or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="Interview not found")
    return session


def _enabled() -> None:
    if not settings.session_media_enabled:
        raise HTTPException(status_code=404, detail="Recording is not available")


@router.post("/{session_id}/media/{index}")
@limiter.limit(settings.upload_rate_limit)
async def upload_media(
    request: Request,
    session_id: int,
    index: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    _enabled()
    session = _owned(db, session_id, current_user)
    if session.status != "active":
        raise HTTPException(status_code=400, detail="This interview has finished")
    if index < 1 or index > settings.interview_max_questions:
        raise HTTPException(status_code=422, detail="Invalid answer number")
    data = await file.read()
    if len(data) > settings.session_media_max_bytes:
        raise HTTPException(status_code=400, detail="Recording too large")
    if not data:
        raise HTTPException(status_code=400, detail="Empty recording")

    content_type = (file.content_type or "").lower()
    has_video = content_type.startswith("video/")
    ext = Path(file.filename or "").suffix.lstrip(".").lower()
    if not ext:
        ext = _SUBTYPE_EXT.get(content_type.split("/")[-1], "webm")
    session_media.save(session_id, index, has_video, ext, data)
    return {"ok": True, "index": index, "has_video": has_video}


@router.get("/{session_id}/media")
def list_media(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    _owned(db, session_id, current_user)
    return [
        {"index": entry["index"], "has_video": entry["has_video"]}
        for entry in session_media.list_media(session_id)
    ]


# Declared before the {index} route so "bundle.zip" is not parsed as an answer number.
@router.get("/{session_id}/media/bundle.zip")
def download_bundle(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    session = _owned(db, session_id, current_user)
    entries = session_media.list_media(session_id)
    if not entries:
        raise HTTPException(status_code=404, detail="No recordings to download")

    questions = [turn.content for turn in session.turns if turn.kind == "question"]
    manifest = {
        "interview": interview.session_title(
            session.company, session.role, session.interview_type, focus=session.focus
        ),
        "created_at": session.created_at.isoformat(),
        "note": (
            "These recordings were stored on the server only for your session and are "
            "yours to keep. The server keeps no copy after your session ends."
        ),
        "answers": [
            {
                "file": entry["path"].name,
                "answer": entry["index"],
                "question": questions[entry["index"] - 1] if entry["index"] <= len(questions) else "",
            }
            for entry in entries
        ],
    }
    data = session_media.bundle(session_id, json.dumps(manifest, indent=2))
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="interview-{session_id}-recordings.zip"'},
    )


@router.get("/{session_id}/media/{index}")
def download_one(
    session_id: int,
    index: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    _owned(db, session_id, current_user)
    entry = session_media.get(session_id, index)
    if entry is None:
        raise HTTPException(status_code=404, detail="No recording for that answer")
    path: Path = entry["path"]
    kind = "video" if entry["has_video"] else "audio"
    return FileResponse(path, media_type=f"{kind}/{path.suffix.lstrip('.')}", filename=path.name)


@router.delete("/{session_id}/media", status_code=204)
def delete_media(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    _owned(db, session_id, current_user)
    session_media.purge(session_id)
    return Response(status_code=204)
