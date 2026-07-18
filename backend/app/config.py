from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Defaults point at the KCL endpoint; override in .env.
    llm_base_url: str = "https://api.ai.create.kcl.ac.uk/v1"
    llm_api_key: str = ""
    llm_model: str = "arc:lite"

    backend_cors_origins: str = "http://localhost:5173"

    database_url: str = "sqlite:///./app.db"
    jwt_secret: str = "change-me-in-env"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Moderation. Each check is a separate model call, so a chat message can cost
    # up to three calls; turn input checking off if the provider rate-limits.
    moderation_enabled: bool = True
    moderate_input_enabled: bool = True
    moderate_output_enabled: bool = True
    moderation_model: str = ""  # falls back to llm_model
    moderation_max_retries: int = 1

    interview_max_questions: int = 6

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.backend_cors_origins.split(",") if o.strip()]


settings = Settings()
