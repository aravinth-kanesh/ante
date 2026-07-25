def signup(client, email="alice@example.com", password="password123"):
    return client.post("/api/auth/signup", json={"email": email, "password": password})


def test_signup_returns_token(client):
    res = signup(client)
    assert res.status_code == 201
    assert res.json()["access_token"]


def test_duplicate_signup_conflicts(client):
    signup(client)
    res = signup(client)
    assert res.status_code == 409


def test_short_password_rejected(client):
    res = signup(client, password="short")
    assert res.status_code == 422


def test_login_success(client):
    signup(client)
    res = client.post(
        "/api/auth/login", json={"email": "alice@example.com", "password": "password123"}
    )
    assert res.status_code == 200
    assert res.json()["access_token"]


def test_login_wrong_password(client):
    signup(client)
    res = client.post(
        "/api/auth/login", json={"email": "alice@example.com", "password": "wrongpassword"}
    )
    assert res.status_code == 401


def test_me_requires_token(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_with_token(client):
    token = signup(client).json()["access_token"]
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["email"] == "alice@example.com"


def test_login_is_rate_limited(client):
    from app.ratelimit import limiter

    limiter.enabled = True
    try:
        codes = [
            client.post(
                "/api/auth/login", json={"email": "nobody@example.com", "password": "nope"}
            ).status_code
            for _ in range(25)
        ]
        assert 429 in codes  # brute-force attempts are throttled
    finally:
        limiter.enabled = False
