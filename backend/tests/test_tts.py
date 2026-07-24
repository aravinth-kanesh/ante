from app.services import tts


def auth_header(client, email="tts@example.com"):
    token = client.post(
        "/api/auth/signup", json={"email": email, "password": "password123"}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_describe_labels_accent_and_gender():
    assert tts.describe("bf_emma") == "Emma (British, female)"
    assert tts.describe("bm_george") == "George (British, male)"
    assert tts.describe("af_sarah") == "Sarah (American, female)"


def test_voices_reports_unavailable_without_the_model(client, monkeypatch):
    monkeypatch.setattr(tts, "available", lambda: False)
    body = client.get("/api/speech/voices", headers=auth_header(client)).json()
    assert body == {"available": False, "voices": []}


def test_voices_lists_installed_voices(client, monkeypatch):
    monkeypatch.setattr(tts, "available", lambda: True)
    monkeypatch.setattr(
        tts, "voices", lambda: [{"id": "bf_emma", "label": "Emma (British, female)"}]
    )
    body = client.get("/api/speech/voices", headers=auth_header(client)).json()
    assert body["available"] is True
    assert body["voices"][0]["id"] == "bf_emma"


def test_say_returns_wav_audio(client, monkeypatch):
    monkeypatch.setattr(tts, "available", lambda: True)
    monkeypatch.setattr(tts, "synthesize", lambda text, voice="": b"RIFFfake")
    res = client.post(
        "/api/speech/say", headers=auth_header(client), json={"text": "Hello", "voice": "bf_emma"}
    )
    assert res.status_code == 200
    assert res.headers["content-type"] == "audio/wav"
    assert res.content == b"RIFFfake"


def test_say_503_without_the_model(client, monkeypatch):
    monkeypatch.setattr(tts, "available", lambda: False)
    res = client.post("/api/speech/say", headers=auth_header(client), json={"text": "Hello"})
    assert res.status_code == 503


def test_say_rejects_empty_text(client, monkeypatch):
    monkeypatch.setattr(tts, "available", lambda: True)
    res = client.post("/api/speech/say", headers=auth_header(client), json={"text": "  "})
    assert res.status_code == 400


def test_voice_endpoints_require_auth(client):
    assert client.get("/api/speech/voices").status_code == 401
    assert client.post("/api/speech/say", json={"text": "hi"}).status_code == 401
