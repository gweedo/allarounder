"""Azure Blob Storage SAS URL generation for cover image uploads."""

import uuid
from datetime import UTC, datetime, timedelta

import httpx
from azure.storage.blob import (
    BlobSasPermissions,
    BlobServiceClient,
    generate_blob_sas,
)

from app.settings import Settings

_ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
_PREVIEW_BYTES = 512
_FETCH_TIMEOUT_SECONDS = 10.0


class ExternalFetchError(Exception):
    """Raised when fetching an externally-hosted image fails (network error or non-2xx)."""


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


def _download_capped(url: str) -> bytes:
    """GET `url` and return its body, enforcing the 10 MB cap without ever
    holding more than that in memory.

    Only http/https are supported (the endpoint calling this is auth-gated to
    editors and sizes are capped either way, so this is a basic scheme guard
    rather than a full SSRF defense). A `Content-Length` response header over
    the cap is rejected before any body bytes are read; a response that lies
    about its length (or omits it) is still capped while streaming.
    """
    if not url.lower().startswith(("http://", "https://")):
        raise ValueError("Only http/https URLs are supported")

    try:
        with httpx.stream(
            "GET", url, follow_redirects=True, timeout=_FETCH_TIMEOUT_SECONDS
        ) as response:
            if not (200 <= response.status_code < 300):
                raise ExternalFetchError(
                    f"Upstream returned status {response.status_code}"
                )
            content_length = response.headers.get("content-length")
            if content_length is not None and int(content_length) > _MAX_SIZE_BYTES:
                raise ValueError(
                    f"File too large: {content_length} bytes (max 10 MB)"
                )
            body = bytearray()
            for chunk in response.iter_bytes():
                body.extend(chunk)
                if len(body) > _MAX_SIZE_BYTES:
                    raise ValueError(
                        f"File too large: exceeds {_MAX_SIZE_BYTES} bytes (max 10 MB)"
                    )
            return bytes(body)
    except httpx.HTTPError as exc:
        raise ExternalFetchError(f"Failed to fetch external image: {exc}") from exc


def import_external_image(*, url: str, settings: Settings) -> str:
    """Download an externally-hosted image and re-upload it to our own Blob
    Storage, returning the resulting blob URL.

    Used for images left behind by a Google Docs (or other rich-text) paste,
    which reference a transient CDN URL rather than a stable one we control.
    """
    content = _download_capped(url)
    mime = validate_image(size=len(content), preview=content[:_PREVIEW_BYTES])

    filename = url.rsplit("/", 1)[-1].split("?", 1)[0] or "image"
    sas_url, blob_url = generate_sas(filename=filename, settings=settings)

    try:
        upload_response = httpx.put(
            sas_url,
            content=content,
            headers={"x-ms-blob-type": "BlockBlob", "Content-Type": mime},
            timeout=_FETCH_TIMEOUT_SECONDS,
        )
        upload_response.raise_for_status()
    except httpx.HTTPError as exc:
        raise RuntimeError(f"Failed to upload to blob storage: {exc}") from exc

    return blob_url
