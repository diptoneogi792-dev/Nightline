import json
from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Nightline API"
    environment: str = "development"
    database_url: str = "sqlite+aiosqlite:///./nightline.db"
    database_direct_url: str | None = None
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:4173",
        "http://localhost:5173",
    ]
    auto_init_db: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("["):
                return json.loads(stripped)
            return [origin.strip() for origin in stripped.split(",") if origin.strip()]
        return value

    @property
    def should_init_tables(self) -> bool:
        return self.auto_init_db or self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()
