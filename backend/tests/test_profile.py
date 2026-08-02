def auth_cookies(client, email="bob@example.com"):
    res = client.post(
        "/api/auth/signup", json={"email": email, "password": "password123"}
    )
    client.cookies.clear()  # keep the jar empty so per-request cookies are unambiguous
    return {"access_token": res.cookies["access_token"]}


def test_profile_requires_auth(client):
    assert client.get("/api/profile").status_code == 401


def test_profile_defaults_empty(client):
    res = client.get("/api/profile", cookies=auth_cookies(client))
    assert res.status_code == 200
    assert res.json() == {"cv_text": "", "cv_filename": "", "jd_text": ""}


def test_profile_roundtrip(client):
    cookies = auth_cookies(client)
    client.put("/api/profile", cookies=cookies, json={"cv_text": "my cv", "jd_text": "my jd"})
    res = client.get("/api/profile", cookies=cookies)
    assert res.json() == {"cv_text": "my cv", "cv_filename": "", "jd_text": "my jd"}
