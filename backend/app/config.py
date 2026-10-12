"""LynceusVision backend application settings."""
from __future__ import annotations

import logging
from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    app_env: Literal["development", "testing", "production"] = "development"
    app_secret_key: str = "INSECURE_DEFAULT_CHANGE_ME"
    log_level: str = "INFO"

    # Database: Must be explicitly configured; no silent default fallback allowed (AGENTS.md Rule 4.2)
    database_url: str | None = None

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    # Connector limits
    connector_timeout_connect: float = 5.0
    connector_timeout_read: float = 15.0
    connector_response_max_bytes: int = 5 * 1024 * 1024  # 5 MB

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, v: str | None) -> str:
        if not v or not v.strip():
            raise ValueError(
                "DATABASE_URL must be explicitly configured. "
                "Silent fallback is prohibited by AGENTS.md Rule 4.2. "
                "For local development, explicitly set "
                "DATABASE_URL=sqlite+aiosqlite:///./lynceusvision-dev.db in your .env file."
            )
        allowed_prefixes = (
            "postgresql+asyncpg://",
            "sqlite+aiosqlite://",
        )
        if not any(v.startswith(p) for p in allowed_prefixes):
            raise ValueError(
                f"DATABASE_URL must use postgresql+asyncpg:// or sqlite+aiosqlite://, got: {v!r}"
            )
        return v

    def configure_logging(self) -> None:
        logging.basicConfig(
            level=getattr(logging, self.log_level.upper(), logging.INFO),
            format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
