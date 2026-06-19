from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_env: str = "development"
    database_url: str = "postgresql+psycopg://allarounder:allarounder@localhost:5432/allarounder"
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 14
    azure_storage_account_name: str = ""
    azure_storage_container_name: str = "images"
    azure_cdn_base_url: str = "https://cdn.allarounder.it/images"
    cors_allowed_origins: str = "http://localhost:3000"
    log_level: str = "DEBUG"


@lru_cache
def get_settings() -> Settings:
    return Settings()
