from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENV: str = "development"
    DATABASE_URL: str | None = None
    REDIS_URL: str | None = None
    JWT_SECRET: str | None = None
    JWT_ALGORITHM: str = "HS256"

    N8N_BASE_URL: str | None = None
    N8N_WEBHOOK_TOKEN: str | None = None

    CSV_DIR: str = "/data/csv"
    REPORTS_DIR: str = "/data/reports"


settings = Settings()

