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
    """Return (sas_url, blob_url) for a direct browser upload."""
    blob_name = f"{uuid.uuid4()}-{filename}"
    expiry = datetime.now(tz=UTC) + timedelta(minutes=5)

    client = BlobServiceClient(
        account_url=f"https://{settings.azure_storage_account_name}.blob.core.windows.net",
    )
    account_key: str = client.credential.account_key

    sas_token = generate_blob_sas(
        account_name=settings.azure_storage_account_name,
        container_name=settings.azure_storage_container_name,
        blob_name=blob_name,
        account_key=account_key,
        permission=BlobSasPermissions(write=True, create=True),
        expiry=expiry,
    )
    sas_url = (
        f"https://{settings.azure_storage_account_name}.blob.core.windows.net"
        f"/{settings.azure_storage_container_name}/{blob_name}?{sas_token}"
    )
    blob_url = f"{settings.azure_cdn_base_url}/{blob_name}"
    return sas_url, blob_url
