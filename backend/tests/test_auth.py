from app.config import settings


def signup(client, email="alice@example.com", password="password123"):
    return client.post("/api/auth/signup", json={"email": email, "password": password})


def test_signup_sets_auth_cookies(client):
    res = signup(client)
    assert res.status_code == 201
    assert res.json()["email"] == "alice@example.com"
    # the token lives in an httpOnly cookie, not the response body
    assert "access_token" not in res.json()
    for cookie in ("access_token", "refresh_token", "csrf_token"):
        assert res.cookies.get(cookie)


def test_duplicate_signup_conflicts(client):
    signup(client)
    res = signup(client)
    assert res.status_code == 409


def test_short_password_rejected(client):
    res = signup(client, password="short")
    assert res.status_code == 422


def test_login_success_sets_cookies(client):
    signup(client)
    client.cookies.clear()
    res = client.post(
        "/api/auth/login", json={"email": "alice@example.com", "password": "password123"}
    )
    assert res.status_code == 200
    assert res.cookies.get("access_token")


def test_login_wrong_password(client):
    signup(client)
    res = client.post(
        "/api/auth/login", json={"email": "alice@example.com", "password": "wrongpassword"}
    )
    assert res.status_code == 401


def test_me_requires_auth(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_with_cookie(client):
    signup(client)  # the client keeps the auth cookie
    res = client.get("/api/auth/me")
    assert res.status_code == 200
    assert res.json()["email"] == "alice@example.com"


def test_refresh_rotates_and_detects_reuse(client):
    res = signup(client)
    r1 = res.cookies["refresh_token"]

    client.cookies.clear()
    first = client.post("/api/auth/refresh", cookies={"refresh_token": r1})
    assert first.status_code == 204
    r2 = first.cookies["refresh_token"]
    assert r2 and r2 != r1

    # replaying the rotated-away token is treated as theft and rejected
    client.cookies.clear()
    reuse = client.post("/api/auth/refresh", cookies={"refresh_token": r1})
    assert reuse.status_code == 401

    # and it burns the whole family, so the rotated-to token stops working too
    client.cookies.clear()
    after = client.post("/api/auth/refresh", cookies={"refresh_token": r2})
    assert after.status_code == 401


def test_logout_revokes_refresh_session(client):
    res = signup(client)
    r1 = res.cookies["refresh_token"]

    assert client.post("/api/auth/logout").status_code == 204

    client.cookies.clear()
    after = client.post("/api/auth/refresh", cookies={"refresh_token": r1})
    assert after.status_code == 401


def test_csrf_blocks_authed_mutation_without_header(client):
    res = signup(client)
    csrf = res.cookies["csrf_token"]
    settings.csrf_enabled = True
    try:
        # an authed state-changing request with no CSRF header is rejected
        assert client.post("/api/auth/logout").status_code == 403
        # echoing the CSRF cookie in the header lets it through
        ok = client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
        assert ok.status_code == 204
    finally:
        settings.csrf_enabled = False


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


def test_delete_account_removes_user_and_data(client):
    signup(client)  # the client holds the auth cookie
    client.post("/api/cv", json={"label": "CV", "text": "my cv"})
    client.put("/api/profile", json={"jd_text": "a role"})

    assert client.delete("/api/auth/me").status_code == 204

    # the account cannot be used or logged into any more
    assert client.get("/api/auth/me").status_code == 401
    login = client.post(
        "/api/auth/login", json={"email": "alice@example.com", "password": "password123"}
    )
    assert login.status_code == 401


def test_delete_account_requires_auth(client):
    client.cookies.clear()
    assert client.delete("/api/auth/me").status_code == 401
