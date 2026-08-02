import logging
import secrets
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import DEFAULT_JWT_SECRET, settings
from app.db import run_migrations
import app.models  # noqa: F401  (register every table on Base.metadata)
from app.ratelimit import limiter
from app.routers import auth, chat, cv, health, interview, prepare, profile, speech, vision
from app.security import ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE

SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}

logger = logging.getLogger("app")

# Refuse to run with the default signing secret in production; warn in development.
if settings.jwt_secret == DEFAULT_JWT_SECRET:
    message = "JWT_SECRET is unset and using the insecure default; set a strong random value."
    if settings.is_production:
        raise RuntimeError(message + " Refusing to start in production.")
    logger.warning(message)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # The test suite manages its own in-memory schema, so skip migrations there.
    if not settings.testing:
        run_migrations()
    yield


app = FastAPI(title="Ante API", lifespan=lifespan)

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
async def csrf_protect(request: Request, call_next):
    # Double-submit CSRF: a state-changing request that carries an auth cookie must
    # echo the CSRF cookie in the X-CSRF-Token header. Requests without an auth
    # cookie (login, signup, password reset) carry no ambient authority to abuse.
    if settings.csrf_enabled and request.method not in SAFE_METHODS:
        authed = ACCESS_COOKIE in request.cookies or REFRESH_COOKIE in request.cookies
        if authed:
            header = request.headers.get("x-csrf-token")
            cookie = request.cookies.get(CSRF_COOKIE)
            if not header or not cookie or not secrets.compare_digest(header, cookie):
                return JSONResponse(
                    status_code=403, content={"detail": "CSRF token missing or invalid"}
                )
    return await call_next(request)


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
