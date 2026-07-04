from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Defaults point at the KCL endpoint; override in .env.
    llm_base_url: str = "https://api.ai.create.kcl.ac.uk/v1"
    llm_api_key: str = ""
    llm_model: str = "arc:lite"

    backend_cors_origins: str = "http://localhost:5173"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.backend_cors_origins.split(",") if o.strip()]


settings = Settings()
