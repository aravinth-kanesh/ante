import asyncio
import logging
import secrets
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import DEFAULT_JWT_SECRET, settings
from app.db import run_migrations
from app.logging import configure_logging, request_id_ctx
import app.models  # noqa: F401  (register every table on Base.metadata)
from app.ratelimit import limiter
from app.services import session_media
from fastapi import Depends

from app.routers import (
    auth,
    cv,
    health,
    interview,
    media,
    practice,
    prepare,
    profile,
    progress,
    saved,
    speech,
    star,
    vision,
)
from app.security import ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE, require_verified_user

SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}

# Content-Security-Policy. 'wasm-unsafe-eval' is required by the in-browser MediaPipe
# models; blob: covers the synthesised audio and worker; 'unsafe-inline' styles are
# needed for the inline style attributes the app uses.
CSP_POLICY = (
    "default-src 'self'; "
    "img-src 'self' data:; "
    "font-src 'self' data:; "
    "media-src 'self' blob:; "
    "worker-src 'self' blob:; "
    "script-src 'self' 'wasm-unsafe-eval'; "
    "style-src 'self' 'unsafe-inline'; "
    "connect-src 'self'; "
    "object-src 'none'; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)
PERMISSIONS_POLICY = "camera=(self), microphone=(self), geolocation=(), payment=()"

configure_logging()
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
    # Sweep any answer recordings left behind by a previous run, then keep sweeping so
    # nothing outlives its TTL even if a browser closed mid-session.
    sweeper = None
    if not settings.testing and settings.session_media_enabled:
        session_media.sweep()
        sweeper = asyncio.create_task(_sweep_media_forever())
    try:
        yield
    finally:
        if sweeper is not None:
            sweeper.cancel()


async def _sweep_media_forever() -> None:
    while True:
        await asyncio.sleep(settings.session_media_sweep_minutes * 60)
        try:
            session_media.sweep()
        except Exception:
            logger.exception("Session media sweep failed")


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
async def request_id(request: Request, call_next):
    rid = uuid.uuid4().hex[:12]
    token = request_id_ctx.set(rid)
    try:
        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response
    finally:
        request_id_ctx.reset(token)


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    # Answer-recording uploads are large by nature and capped in the handler instead.
    if "/media/" not in request.url.path:
        content_length = request.headers.get("content-length")
        if content_length and content_length.isdigit() and int(content_length) > settings.max_request_bytes:
            return JSONResponse(status_code=413, content={"detail": "Request body too large"})
    return await call_next(request)


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
    response.headers["Permissions-Policy"] = PERMISSIONS_POLICY
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
    csp_header = "Content-Security-Policy-Report-Only" if settings.csp_report_only else "Content-Security-Policy"
    response.headers[csp_header] = CSP_POLICY
    if settings.is_production:
        # Assumes TLS is terminated in front of the app (reverse proxy / platform).
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response


app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")

# The main app requires a verified email (when verification is enabled); health and
# auth stay open so users can sign in, verify and manage their account.
verified = [Depends(require_verified_user)]
app.include_router(profile.router, prefix="/api", dependencies=verified)
app.include_router(cv.router, prefix="/api", dependencies=verified)
app.include_router(prepare.router, prefix="/api", dependencies=verified)
app.include_router(interview.router, prefix="/api", dependencies=verified)
app.include_router(practice.router, prefix="/api", dependencies=verified)
app.include_router(star.router, prefix="/api", dependencies=verified)
app.include_router(saved.router, prefix="/api", dependencies=verified)
app.include_router(media.router, prefix="/api", dependencies=verified)
app.include_router(progress.router, prefix="/api", dependencies=verified)
app.include_router(speech.router, prefix="/api", dependencies=verified)
app.include_router(vision.router, prefix="/api", dependencies=verified)
