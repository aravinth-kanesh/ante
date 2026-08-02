from app.config import settings


def test_security_headers_present(client):
    res = client.get("/api/health")
    headers = res.headers
    assert headers["X-Content-Type-Options"] == "nosniff"
    assert headers["X-Frame-Options"] == "DENY"
    assert "camera=(self)" in headers["Permissions-Policy"]
    assert headers["Cross-Origin-Opener-Policy"] == "same-origin"
    # report-only by default so it can be checked before it is enforced
    assert "default-src 'self'" in headers["Content-Security-Policy-Report-Only"]
    assert "wasm-unsafe-eval" in headers["Content-Security-Policy-Report-Only"]


def test_csp_enforced_when_not_report_only(client):
    settings.csp_report_only = False
    try:
        res = client.get("/api/health")
        assert "Content-Security-Policy" in res.headers
        assert "Content-Security-Policy-Report-Only" not in res.headers
    finally:
        settings.csp_report_only = True


def test_oversized_request_body_rejected(client):
    original = settings.max_request_bytes
    settings.max_request_bytes = 10  # bytes
    try:
        res = client.post(
            "/api/auth/login", json={"email": "someone@example.com", "password": "password123"}
        )
        assert res.status_code == 413
    finally:
        settings.max_request_bytes = original


def test_answer_length_is_capped(client):
    # the schema rejects an absurdly long answer before it reaches the model
    from app.schemas.interview import AnswerRequest
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        AnswerRequest(answer="x" * 20001)
