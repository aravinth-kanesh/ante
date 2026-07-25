import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import DEFAULT_JWT_SECRET, settings
from app.db import Base, engine, ensure_columns
from app.models import cv as _cv  # noqa: F401  (register tables)
from app.models import profile as _profile  # noqa: F401
from app.models import session as _session  # noqa: F401
from app.models import user as _user  # noqa: F401
from app.ratelimit import limiter
from app.routers import auth, chat, cv, health, interview, prepare, profile, speech, vision

logger = logging.getLogger("app")

# Refuse to run with the default signing secret in production; warn in development.
if settings.jwt_secret == DEFAULT_JWT_SECRET:
    message = "JWT_SECRET is unset and using the insecure default; set a strong random value."
    if settings.is_production:
        raise RuntimeError(message + " Refusing to start in production.")
    logger.warning(message)

Base.metadata.create_all(bind=engine)
ensure_columns()

app = FastAPI(title="Ante API")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    if settings.is_production:
        # Assumes TLS is terminated in front of the app (reverse proxy / platform).
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response


app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(cv.router, prefix="/api")
app.include_router(prepare.router, prefix="/api")
app.include_router(interview.router, prefix="/api")
app.include_router(speech.router, prefix="/api")
app.include_router(vision.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
