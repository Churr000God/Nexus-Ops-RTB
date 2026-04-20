from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENV: str = "development"
    DATABASE_URL: str | None = None
    REDIS_URL: str | None = None
    JWT_SECRET: str | None = None
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALLOWED_ORIGINS: str = ""
    COOKIE_REFRESH_NAME: str = "refresh_token"

    N8N_BASE_URL: str | None = None
    N8N_WEBHOOK_TOKEN: str | None = None

    CSV_DIR: str = "/data/csv"
    REPORTS_DIR: str = "/data/reports"
    LOG_LEVEL: str = "INFO"

    @property
    def allowed_origins_list(self) -> list[str]:
        configured = [
            origin.strip()
            for origin in self.ALLOWED_ORIGINS.split(",")
            if origin.strip()
        ]
        if configured:
            return configured
        if self.ENV.lower() == "development":
            return [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:80",
                "http://127.0.0.1:80",
                "http://localhost",
                "http://127.0.0.1",
            ]
        return []

    @property
    def cookie_secure(self) -> bool:
        return self.ENV.lower() != "development"


settings = Settings()
