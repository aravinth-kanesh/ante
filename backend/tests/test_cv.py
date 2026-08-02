import io

import pytest
from docx import Document

from app.services.cv_parse import extract_text


def docx_bytes(*paragraphs):
    document = Document()
    for p in paragraphs:
        document.add_paragraph(p)
    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def test_extracts_docx():
    data = docx_bytes("Aravinth K", "Final-year CS student")
    text = extract_text("cv.docx", data)
    assert "Aravinth K" in text and "Final-year CS student" in text


def test_extracts_txt():
    assert extract_text("cv.txt", b"plain text cv") == "plain text cv"


def test_unsupported_type_raises():
    with pytest.raises(ValueError):
        extract_text("cv.png", b"binary")


def auth_cookies(client, email="cv@example.com"):
    res = client.post(
        "/api/auth/signup", json={"email": email, "password": "password123"}
    )
    client.cookies.clear()  # keep the jar empty so per-request cookies are unambiguous
    return {"access_token": res.cookies["access_token"]}


def test_upload_requires_auth(client):
    res = client.post("/api/profile/cv", files={"file": ("cv.txt", b"hello", "text/plain")})
    assert res.status_code == 401


def test_upload_saves_text_and_filename(client):
    cookies = auth_cookies(client)
    res = client.post(
        "/api/profile/cv",
        cookies=cookies,
        files={"file": ("my cv.txt", b"experience and skills", "text/plain")},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["cv_text"] == "experience and skills"
    assert body["cv_filename"] == "my cv.txt"

    # persists on the account
    again = client.get("/api/profile", cookies=cookies).json()
    assert again["cv_text"] == "experience and skills"


def test_upload_rejects_unsupported_extension(client):
    res = client.post(
        "/api/profile/cv",
        cookies=auth_cookies(client, "cv2@example.com"),
        files={"file": ("cv.png", b"binary", "image/png")},
    )
    assert res.status_code == 400