"""Application logging: a single stdout handler with an optional JSON format, a
per-request correlation id, and a redaction pass so secrets never reach the logs.
"""

import json
import logging
import re
from contextvars import ContextVar

from app.config import settings

# Set per request by the request-id middleware; read by the logging filter.
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")

# Mask the value after any key that looks sensitive, e.g. password=..., token: ...,
# Authorization=Bearer ..., set-cookie: .... The value is masked to the end of the
# line so a "Bearer <jwt>" style value is never left partly exposed.
_SECRET_RE = re.compile(
    r'(?i)(password|passwd|token|secret|authorization|cookie|api[_-]?key|jwt)("?\s*[:=]\s*)([^\r\n]+)'
)


def _redact(message: str) -> str:
    return _SECRET_RE.sub(lambda m: f"{m.group(1)}{m.group(2)}[redacted]", message)


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get()
        return True


class TextFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return _redact(super().format(record))


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "time": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "request_id": getattr(record, "request_id", "-"),
            "message": _redact(record.getMessage()),
        }
        if record.exc_info:
            payload["exc_info"] = _redact(self.formatException(record.exc_info))
        return json.dumps(payload)


def configure_logging() -> None:
    handler = logging.StreamHandler()
    handler.addFilter(RequestIdFilter())
    if settings.log_format.lower() == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            TextFormatter("%(asctime)s %(levelname)s [%(name)s] [%(request_id)s] %(message)s")
        )

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(settings.log_level.upper())
