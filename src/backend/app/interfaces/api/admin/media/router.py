"""Admin media endpoints: SAS token for direct browser upload, and server-side
import of externally-hosted images (e.g. left behind by a Google Docs paste)
to Azure Blob Storage."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.infrastructure.media.blob_storage import (
    ExternalFetchError,
    generate_sas,
    import_external_image,
    validate_image,
)
from app.interfaces.api.admin.media.schemas import (
    ImportRequest,
    ImportResponse,
    SasRequest,
    SasResponse,
)
from app.interfaces.api.auth.dependencies import require_editor
from app.settings import Settings, get_settings

router = APIRouter(prefix="/api/admin/media", tags=["media"])


@router.post("/sas", response_model=SasResponse)
def request_sas(
    body: SasRequest,
    _current_user: Annotated[object, Depends(require_editor)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> SasResponse:
    try:
        validate_image(size=body.size, preview=body.preview_bytes())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    try:
        sas_url, blob_url = generate_sas(filename=body.filename, settings=settings)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Storage service temporarily unavailable",
        )

    return SasResponse(sas_url=sas_url, blob_url=blob_url)


@router.post("/import", response_model=ImportResponse)
def import_media(
    body: ImportRequest,
    _current_user: Annotated[object, Depends(require_editor)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ImportResponse:
    try:
        blob_url = import_external_image(url=str(body.url), settings=settings)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except ExternalFetchError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Storage service temporarily unavailable",
        )

    return ImportResponse(blob_url=blob_url)
