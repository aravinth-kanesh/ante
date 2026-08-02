import logging

from app.logging import JsonFormatter, TextFormatter, _redact


def test_redact_masks_sensitive_values():
    assert _redact("password=hunter2") == "password=[redacted]"
    assert _redact("Authorization: Bearer abc.def.ghi") == "Authorization: [redacted]"
    assert _redact("set a cookie=token123 now").startswith("set a cookie=[redacted]")
    assert _redact("nothing secret here") == "nothing secret here"


def _record(message: str) -> logging.LogRecord:
    return logging.LogRecord("app", logging.INFO, __file__, 1, message, None, None)


def test_text_formatter_redacts():
    out = TextFormatter("%(message)s").format(_record("token=abc123"))
    assert "abc123" not in out and "[redacted]" in out


def test_json_formatter_redacts_and_is_json():
    import json

    out = JsonFormatter().format(_record("api_key=secretvalue"))
    payload = json.loads(out)
    assert "secretvalue" not in payload["message"]
    assert payload["level"] == "INFO"
