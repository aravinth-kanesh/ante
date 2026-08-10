import io
import os
import time
import zipfile

from app.config import settings
from app.services import interview, session_media
from app.services.moderation import Verdict


def auth_cookies(client, email="media@example.com"):
    res = client.post("/api/auth/signup", json={"email": email, "password": "password123"})
    client.cookies.clear()
    return {"access_token": res.cookies["access_token"]}


def save_cv(client, cookies):
    client.put("/api/profile", cookies=cookies, json={"cv_text": "my cv", "jd_text": ""})


def mock_llm(monkeypatch):
    monkeypatch.setattr(interview.llm, "chat", lambda *a, **k: "Tell me about a project.")
    monkeypatch.setattr(interview.moderation, "moderate_output", lambda t: Verdict(allowed=True))


def start(client, cookies):
    return client.post(
        "/api/interview/start", cookies=cookies, json={"mode": "voice"}
    ).json()["session_id"]


def upload(client, cookies, sid, index, data=b"recording-bytes", content_type="video/webm"):
    return client.post(
        f"/api/interview/{sid}/media/{index}",
        cookies=cookies,
        files={"file": (f"q{index}.webm", data, content_type)},
    )


def test_upload_list_download_bundle_delete(client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "session_media_dir", str(tmp_path))
    mock_llm(monkeypatch)
    cookies = auth_cookies(client)
    save_cv(client, cookies)
    sid = start(client, cookies)

    res = upload(client, cookies, sid, 1, b"videodata", "video/webm")
    assert res.status_code == 200 and res.json()["has_video"] is True

    assert client.get(f"/api/interview/{sid}/media", cookies=cookies).json() == [
        {"index": 1, "has_video": True}
    ]

    dl = client.get(f"/api/interview/{sid}/media/1", cookies=cookies)
    assert dl.status_code == 200 and dl.content == b"videodata"

    bundle = client.get(f"/api/interview/{sid}/media/bundle.zip", cookies=cookies)
    assert bundle.status_code == 200
    archive = zipfile.ZipFile(io.BytesIO(bundle.content))
    assert "manifest.json" in archive.namelist()
    assert any(name.startswith("q01_video") for name in archive.namelist())

    assert client.delete(f"/api/interview/{sid}/media", cookies=cookies).status_code == 204
    assert client.get(f"/api/interview/{sid}/media", cookies=cookies).json() == []


def test_audio_only_upload_is_not_marked_as_video(client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "session_media_dir", str(tmp_path))
    mock_llm(monkeypatch)
    cookies = auth_cookies(client)
    save_cv(client, cookies)
    sid = start(client, cookies)
    assert upload(client, cookies, sid, 1, b"a", "audio/webm").json()["has_video"] is False
    assert client.get(f"/api/interview/{sid}/media", cookies=cookies).json()[0]["has_video"] is False


def test_media_requires_ownership(client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "session_media_dir", str(tmp_path))
    mock_llm(monkeypatch)
    owner = auth_cookies(client, "owner@example.com")
    save_cv(client, owner)
    sid = start(client, owner)
    intruder = auth_cookies(client, "intruder@example.com")
    save_cv(client, intruder)
    assert upload(client, intruder, sid, 1).status_code == 404
    assert client.get(f"/api/interview/{sid}/media", cookies=intruder).status_code == 404


def test_upload_rejects_oversized_and_bad_index(client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "session_media_dir", str(tmp_path))
    monkeypatch.setattr(settings, "session_media_max_bytes", 8)
    mock_llm(monkeypatch)
    cookies = auth_cookies(client)
    save_cv(client, cookies)
    sid = start(client, cookies)
    assert upload(client, cookies, sid, 1, b"far-too-long").status_code == 400
    assert upload(client, cookies, sid, 0, b"x").status_code == 422
    assert upload(client, cookies, sid, 99, b"x").status_code == 422


def test_deleting_interview_purges_recordings(client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "session_media_dir", str(tmp_path))
    mock_llm(monkeypatch)
    cookies = auth_cookies(client)
    save_cv(client, cookies)
    sid = start(client, cookies)
    upload(client, cookies, sid, 1, b"x", "audio/webm")
    assert session_media.list_media(sid)
    client.delete(f"/api/interview/{sid}", cookies=cookies)
    assert session_media.list_media(sid) == []


def test_deleting_account_purges_recordings(client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "session_media_dir", str(tmp_path))
    mock_llm(monkeypatch)
    cookies = auth_cookies(client, "gone@example.com")
    save_cv(client, cookies)
    sid = start(client, cookies)
    upload(client, cookies, sid, 1, b"x", "audio/webm")
    client.delete("/api/auth/me", cookies=cookies)
    assert session_media.list_media(sid) == []


def test_sweeper_removes_sessions_past_the_ttl(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "session_media_dir", str(tmp_path))
    session_media.save(999, 1, False, "webm", b"x")
    directory = tmp_path / "999"
    old = time.time() - 3600
    os.utime(directory, (old, old))
    assert session_media.sweep(ttl_minutes=1) == 1
    assert not directory.exists()
