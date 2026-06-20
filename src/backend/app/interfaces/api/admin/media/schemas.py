import base64

from pydantic import BaseModel, field_validator


class SasRequest(BaseModel):
    filename: str
    size: int
    preview: str  # base64-encoded first 512 bytes

    @field_validator("preview")
    @classmethod
    def validate_preview(cls, v: str) -> str:
        try:
            base64.b64decode(v)
        except Exception as exc:
            raise ValueError("preview must be valid base64") from exc
        return v

    def preview_bytes(self) -> bytes:
        return base64.b64decode(self.preview)


class SasResponse(BaseModel):
    sas_url: str
    blob_url: str
