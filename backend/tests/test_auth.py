import re

import pytest
from fastapi import HTTPException

from app.config import settings
from app.models.user import User
from app.security import require_verified_user
from app.services import email as email_service, passwords


def signup(client, email="alice@example.com", password="password123"):
    return client.post("/api/auth/signup", json={"email": email, "password": password})


def _token_from(link: str) -> str:
    match = re.search(r"token=([^&\s]+)", link)
    assert match, f"no token in {link!r}"
    return match.group(1)


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


def test_signup_rejects_breached_password(client, monkeypatch):
    monkeypatch.setattr(passwords, "is_breached", lambda password: True)
    assert signup(client).status_code == 400


def test_login_lockout_after_repeated_failures(client):
    signup(client, email="lock@example.com")
    client.cookies.clear()
    for _ in range(settings.max_failed_logins):
        client.post("/api/auth/login", json={"email": "lock@example.com", "password": "wrong"})
    # even the correct password is refused while the account is locked
    res = client.post("/api/auth/login", json={"email": "lock@example.com", "password": "password123"})
    assert res.status_code == 403


def test_email_verification_flow(client, monkeypatch):
    links: list[str] = []
    monkeypatch.setattr(email_service, "send_verification", lambda to, link: links.append(link))
    settings.require_email_verification = True
    try:
        res = signup(client, email="verify@example.com")
        assert res.status_code == 201
        assert res.json()["is_verified"] is False
        assert not res.cookies.get("access_token")  # no session until verified

        blocked = client.post(
            "/api/auth/login", json={"email": "verify@example.com", "password": "password123"}
        )
        assert blocked.status_code == 403  # cannot sign in before verifying

        token = _token_from(links[-1])
        verified = client.post("/api/auth/verify", json={"token": token})
        assert verified.status_code == 200
        assert verified.json()["is_verified"] is True
        assert verified.cookies.get("access_token")  # verifying logs them in

        # the token is single use
        assert client.post("/api/auth/verify", json={"token": token}).status_code == 400
    finally:
        settings.require_email_verification = None


def test_password_reset_flow(client, monkeypatch):
    links: list[str] = []
    monkeypatch.setattr(email_service, "send_password_reset", lambda to, link: links.append(link))
    signup(client, email="reset@example.com")
    client.cookies.clear()

    # an unknown address gets the same 204 and no email, so it cannot be probed
    assert client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"}).status_code == 204
    assert links == []
    assert client.post("/api/auth/forgot-password", json={"email": "reset@example.com"}).status_code == 204

    token = _token_from(links[-1])
    reset = client.post(
        "/api/auth/reset-password", json={"token": token, "password": "brandnewpass1"}
    )
    assert reset.status_code == 204

    old = client.post("/api/auth/login", json={"email": "reset@example.com", "password": "password123"})
    assert old.status_code == 401
    new = client.post("/api/auth/login", json={"email": "reset@example.com", "password": "brandnewpass1"})
    assert new.status_code == 200


def test_change_password(client):
    signup(client, email="change@example.com")  # the client holds the session
    ok = client.post(
        "/api/auth/change-password",
        json={"current_password": "password123", "new_password": "brandnewpass1"},
    )
    assert ok.status_code == 204
    bad = client.post(
        "/api/auth/change-password",
        json={"current_password": "wrongcurrent", "new_password": "anotherpass1"},
    )
    assert bad.status_code == 400


def test_data_export_returns_account_data(client):
    signup(client, email="export@example.com")
    client.post("/api/cv", json={"label": "CV", "text": "my cv"})
    res = client.get("/api/auth/export")
    assert res.status_code == 200
    body = res.json()
    assert body["account"]["email"] == "export@example.com"
    assert body["cvs"][0]["text"] == "my cv"


def test_auth_config_reports_verification(client):
    res = client.get("/api/auth/config")
    assert res.status_code == 200
    assert res.json() == {"verification_required": False}


def test_require_verified_user_gate():
    settings.require_email_verification = True
    try:
        unverified = User(email="x@example.com", hashed_password="x", is_verified=False)
        with pytest.raises(HTTPException) as err:
            require_verified_user(unverified)
        assert err.value.status_code == 403
        unverified.is_verified = True
        assert require_verified_user(unverified) is unverified
    finally:
        settings.require_email_verification = None
