def auth_header(client, email="bob@example.com"):
    token = client.post(
        "/api/auth/signup", json={"email": email, "password": "password123"}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_profile_requires_auth(client):
    assert client.get("/api/profile").status_code == 401


def test_profile_defaults_empty(client):
    res = client.get("/api/profile", headers=auth_header(client))
    assert res.status_code == 200
    assert res.json() == {"cv_text": "", "jd_text": ""}


def test_profile_roundtrip(client):
    headers = auth_header(client)
    client.put("/api/profile", headers=headers, json={"cv_text": "my cv", "jd_text": "my jd"})
    res = client.get("/api/profile", headers=headers)
    assert res.json() == {"cv_text": "my cv", "jd_text": "my jd"}
