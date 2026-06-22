from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_KEY = "change-me-in-production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_env: str = "development"
    database_url: str = "postgresql+psycopg://allarounder:allarounder@localhost:5432/allarounder"
    azure_use_managed_identity: bool = False
    jwt_secret_key: str = _INSECURE_KEY

    @model_validator(mode="after")
    def _check_jwt_secret(self) -> "Settings":
        if self.app_env != "development" and self.jwt_secret_key == _INSECURE_KEY:
            raise ValueError(
                "JWT_SECRET_KEY must be set to a secure value in non-development environments"
            )
        return self
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 14
    azure_storage_account_name: str = ""
    azure_storage_account_key: str = ""
    azure_storage_container_name: str = "images"
    trust_forwarded_for: bool = False
    azure_cdn_base_url: str = "https://cdn.allarounder.it/images"
    cors_allowed_origins: str = "http://localhost:3000"
    log_level: str = "DEBUG"


@lru_cache
def get_settings() -> Settings:
    return Settings()
