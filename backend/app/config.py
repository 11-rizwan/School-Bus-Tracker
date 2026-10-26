from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Look for .env in current working directory, app parent, or project root
def find_env_file() -> str:
    candidates = [
        Path.cwd() / ".env",
        Path(__file__).resolve().parent.parent / ".env",
        Path(__file__).resolve().parents[2] / ".env",
    ]
    for p in candidates:
        if p.is_file():
            return str(p)
    return ".env"


class Settings(BaseSettings):
    postgres_db: str = "schoolbus"
    postgres_user: str = "schoolbus_app"
    postgres_password: str = ""

    database_url: str = "sqlite:///./schoolbus.db"

    jwt_secret_key: str = ""
    access_token_expire_minutes: int = 60

    bootstrap_admin_email: str = ""
    bootstrap_admin_password: str = ""

    cors_origins: str = "http://localhost:8080,http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def DATABASE_URL(self) -> str:
        return self.database_url

    @property
    def JWT_SECRET_KEY(self) -> str:
        return self.jwt_secret_key

    @property
    def POSTGRES_DB(self) -> str:
        return self.postgres_db

    @property
    def POSTGRES_USER(self) -> str:
        return self.postgres_user

    @property
    def POSTGRES_PASSWORD(self) -> str:
        return self.postgres_password

    @property
    def ACCESS_TOKEN_EXPIRE_MINUTES(self) -> int:
        return self.access_token_expire_minutes

    @property
    def BOOTSTRAP_ADMIN_EMAIL(self) -> str:
        return self.bootstrap_admin_email

    @property
    def BOOTSTRAP_ADMIN_PASSWORD(self) -> str:
        return self.bootstrap_admin_password

    @property
    def CORS_ORIGINS(self) -> str:
        return self.cors_origins

    model_config = SettingsConfigDict(
        env_file=find_env_file(),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )


settings = Settings()
