from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_JWT_SECRET = "change-me-in-env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Defaults point at the KCL endpoint; override in .env.
    llm_base_url: str = "https://api.ai.create.kcl.ac.uk/v1"
    llm_api_key: str = ""
    llm_model: str = "arc:lite"

    backend_cors_origins: str = "http://localhost:5173"

    environment: str = "development"  # set to "production" to enforce a real secret
    testing: bool = False  # set by the test suite to skip startup migrations
    database_url: str = "sqlite:///./app.db"
    jwt_secret: str = DEFAULT_JWT_SECRET
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15  # short-lived; the refresh token keeps sessions alive
    refresh_token_expire_days: int = 30

    # Auth cookies. Tokens live in httpOnly cookies (not JS-readable) with a
    # double-submit CSRF token. Secure defaults to on in production; SameSite=Lax
    # suits a same-origin deployment (set "none" only for a cross-site frontend).
    cookie_secure: bool | None = None  # None means "on in production"
    cookie_samesite: str = "lax"
    csrf_enabled: bool = True

    # Auth rate limits (requests per window, per client IP), for brute-force defence.
    auth_rate_limit: str = "10/minute"

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def secure_cookies(self) -> bool:
        return self.is_production if self.cookie_secure is None else self.cookie_secure

    # Moderation. Each check is a separate model call, so a chat message can cost
    # up to three calls; turn input checking off if the provider rate-limits.
    moderation_enabled: bool = True
    moderate_input_enabled: bool = True
    moderate_output_enabled: bool = True
    moderation_model: str = ""  # falls back to llm_model
    moderation_max_retries: int = 1

    interview_max_questions: int = 6

    # Speech delivery analysis. Answer audio is transcribed with faster-whisper
    # to measure speaking pace, pauses and filler words. Audio is processed in
    # memory and never written to disk (LSEPI no-storage policy).
    speech_enabled: bool = True
    whisper_model: str = "base.en"
    speech_pause_sec: float = 0.5  # a gap this long or longer counts as a pause
    speech_long_pause_sec: float = 1.5  # and this long counts as a long pause

    # Webcam nonverbal analysis. Per-frame signals are captured in the browser with
    # MediaPipe and aggregated here; no video or image leaves the browser, only the
    # derived numbers below (LSEPI no-storage policy). Expression is gated on its
    # own flag because it edges into EU AI Act Art 5 emotion-recognition territory.
    nonverbal_enabled: bool = True
    expression_enabled: bool = True
    eye_contact_yaw_deg: float = 15.0  # head turned within this of centre counts as facing the camera
    eye_contact_pitch_deg: float = 12.0
    smile_threshold: float = 0.3  # mean smile blendshape at or above this counts as smiling
    nonverbal_max_samples: int = 3000  # cap the per-answer sample array defensively

    # Interviewer voice. Kokoro is a small open-weight model run locally, so the
    # question text never leaves this machine and there is no API key or cost.
    # Fetch the model with `python scripts/fetch_tts_model.py`; without it the
    # frontend falls back to the browser's own voices.
    tts_enabled: bool = True
    tts_model_path: str = "models/kokoro-v1.0.onnx"
    tts_voices_path: str = "models/voices-v1.0.bin"
    tts_voice: str = "bf_emma"  # British female by default
    tts_speed: float = 1.0
    tts_max_chars: int = 800

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.backend_cors_origins.split(",") if o.strip()]


settings = Settings()
