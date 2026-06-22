"""Azure Blob Storage SAS URL generation for cover image uploads."""

import uuid
from datetime import UTC, datetime, timedelta

from azure.storage.blob import (
    BlobSasPermissions,
    BlobServiceClient,
    generate_blob_sas,
)

from app.settings import Settings

_ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
_PREVIEW_BYTES = 512


def _guess_mime(preview: bytes) -> str:
    import filetype

    kind = filetype.guess(preview)
    if kind is None:
        return "application/octet-stream"
    return str(kind.mime)


def validate_image(*, size: int, preview: bytes) -> str:
    """Validate size and magic bytes. Returns the detected MIME type."""
    if size > _MAX_SIZE_BYTES:
        raise ValueError(f"File too large: {size} bytes (max 10 MB)")
    mime = _guess_mime(preview)
    if mime not in _ALLOWED_MIME_TYPES:
        raise ValueError(f"Unsupported file type: {mime!r}. Only JPEG, PNG, WebP, GIF are allowed.")
    return mime


def generate_sas(*, filename: str, settings: Settings) -> tuple[str, str]:
    """Return (sas_url, blob_url) for a direct browser upload.

    Uses User Delegation SAS when azure_use_managed_identity=True (production),
    account-key SAS otherwise (local dev with Azurite or azure_storage_account_key set).
    """
    blob_name = f"{uuid.uuid4()}-{filename}"
    now = datetime.now(tz=UTC)
    expiry = now + timedelta(minutes=5)
    account_url = (
        f"https://{settings.azure_storage_account_name}.blob.core.windows.net"
    )

    if settings.azure_use_managed_identity:
        from azure.identity import DefaultAzureCredential

        client = BlobServiceClient(account_url=account_url, credential=DefaultAzureCredential())
        delegation_key = client.get_user_delegation_key(
            key_start_time=now,
            key_expiry_time=expiry,
        )
        sas_token = generate_blob_sas(
            account_name=settings.azure_storage_account_name,
            container_name=settings.azure_storage_container_name,
            blob_name=blob_name,
            user_delegation_key=delegation_key,
            permission=BlobSasPermissions(write=True, create=True),
            expiry=expiry,
        )
    else:
        if not settings.azure_storage_account_key:
            raise ValueError(
                "AZURE_STORAGE_ACCOUNT_KEY must be set when not using managed identity"
            )
        sas_token = generate_blob_sas(
            account_name=settings.azure_storage_account_name,
            container_name=settings.azure_storage_container_name,
            blob_name=blob_name,
            account_key=settings.azure_storage_account_key,
            permission=BlobSasPermissions(write=True, create=True),
            expiry=expiry,
        )

    sas_url = f"{account_url}/{settings.azure_storage_container_name}/{blob_name}?{sas_token}"
    blob_url = f"{settings.azure_cdn_base_url}/{blob_name}"
    return sas_url, blob_url
