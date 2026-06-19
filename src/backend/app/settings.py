from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str = "postgresql+psycopg://allarounder:allarounder@localhost:5432/allarounder"
    jwt_secret_key: str = "change-me-in-production"
    azure_storage_account_name: str = ""
    azure_storage_container_name: str = "images"
    azure_cdn_base_url: str = "https://cdn.allarounder.it/images"
    cors_allowed_origins: str = "http://localhost:3000"
    log_level: str = "DEBUG"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
