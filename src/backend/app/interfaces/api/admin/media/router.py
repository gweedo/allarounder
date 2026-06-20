"""Admin media endpoints: SAS token for direct browser upload to Azure Blob Storage."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.infrastructure.media.blob_storage import generate_sas, validate_image
from app.interfaces.api.admin.media.schemas import SasRequest, SasResponse
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
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage unavailable: {exc}",
        )

    return SasResponse(sas_url=sas_url, blob_url=blob_url)
