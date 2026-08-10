"""Temporary storage for the recordings a candidate can replay and download.

Media lives on disk only for the length of a session, in a directory that is never
committed or backed up, and is deleted when the session ends, when the candidate
deletes it, or when the sweeper removes anything older than the TTL. The database
never holds audio or video, only the derived numbers (LSEPI no-storage policy).

Each answer's file is named ``q{index:02d}_{kind}.{ext}`` where kind is "audio" or
"video", so the listing can say which answers have video without opening the files.
"""

import io
import re
import shutil
import time
import zipfile
from pathlib import Path

from app.config import settings

_NAME = re.compile(r"^q(\d+)_(audio|video)\.([A-Za-z0-9]+)$")


def _root() -> Path:
    return Path(settings.session_media_dir)


def _session_dir(session_id: int) -> Path:
    return _root() / str(session_id)


def _safe_ext(ext: str) -> str:
    ext = "".join(c for c in ext.lower() if c.isalnum())
    return ext or "webm"


def save(session_id: int, index: int, has_video: bool, ext: str, data: bytes) -> Path:
    """Write one answer's recording, replacing any existing file for that answer."""
    directory = _session_dir(session_id)
    directory.mkdir(parents=True, exist_ok=True)
    # Drop any previous recording for this answer (a re-recorded answer, say).
    for existing in directory.glob(f"q{index:02d}_*"):
        existing.unlink(missing_ok=True)
    kind = "video" if has_video else "audio"
    path = directory / f"q{index:02d}_{kind}.{_safe_ext(ext)}"
    path.write_bytes(data)
    return path


def list_media(session_id: int) -> list[dict]:
    """The recordings held for a session, ordered by answer, as light metadata."""
    directory = _session_dir(session_id)
    if not directory.exists():
        return []
    entries: list[dict] = []
    for path in directory.iterdir():
        match = _NAME.match(path.name)
        if match:
            entries.append(
                {"index": int(match.group(1)), "has_video": match.group(2) == "video", "path": path}
            )
    entries.sort(key=lambda entry: entry["index"])
    return entries


def get(session_id: int, index: int) -> dict | None:
    return next((entry for entry in list_media(session_id) if entry["index"] == index), None)


def purge(session_id: int) -> None:
    shutil.rmtree(_session_dir(session_id), ignore_errors=True)


def sweep(ttl_minutes: int | None = None) -> int:
    """Delete any session's media older than the TTL. Returns how many were removed."""
    ttl = settings.session_media_ttl_minutes if ttl_minutes is None else ttl_minutes
    root = _root()
    if not root.exists():
        return 0
    cutoff = time.time() - ttl * 60
    removed = 0
    for directory in root.iterdir():
        if directory.is_dir() and directory.stat().st_mtime < cutoff:
            shutil.rmtree(directory, ignore_errors=True)
            removed += 1
    return removed


def bundle(session_id: int, manifest: str) -> bytes:
    """A zip of a session's recordings plus a manifest, for the candidate to keep."""
    buffer = io.BytesIO()
    # The media is already compressed, so store without recompressing.
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_STORED) as archive:
        for entry in list_media(session_id):
            archive.write(entry["path"], arcname=entry["path"].name)
        archive.writestr("manifest.json", manifest)
    return buffer.getvalue()
