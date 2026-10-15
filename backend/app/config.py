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
    app_secret_key: str | None = None
    log_level: str = "INFO"

    # Database must be explicit; there is no silent fallback.
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
            raise ValueError("DATABASE_URL must use postgresql+asyncpg:// or sqlite+aiosqlite://.")
        return v

    @field_validator("app_secret_key")
    @classmethod
    def validate_secret(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return value
        if value in {"INSECURE_DEFAULT_CHANGE_ME", "CHANGE_ME_use_openssl_rand_-hex_32"}:
            raise ValueError("APP_SECRET_KEY must be replaced with a private random secret.")
        if len(value) < 32:
            raise ValueError("APP_SECRET_KEY must contain at least 32 characters.")
        return value

    def model_post_init(self, __context: object) -> None:
        if self.app_env == "production" and not self.app_secret_key:
            raise ValueError("APP_SECRET_KEY is required in production.")
        if self.connector_response_max_bytes < 1:
            raise ValueError("CONNECTOR_RESPONSE_MAX_BYTES must be positive.")

    def configure_logging(self) -> None:
        logging.basicConfig(
            level=getattr(logging, self.log_level.upper(), logging.INFO),
            format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
