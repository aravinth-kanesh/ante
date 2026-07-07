from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import Base, engine
from app.models import profile as _profile  # noqa: F401  (register tables)
from app.models import user as _user  # noqa: F401
from app.routers import auth, chat, health, profile

Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Interview Practice API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
