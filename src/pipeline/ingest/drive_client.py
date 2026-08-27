"""Google Drive access: export Docs, read metadata (CONTENT-CONTRACT.md §6, §8).

Read-only for the service account -- Sheets, not Drive, is where the
pipeline writes anything back.
"""

from __future__ import annotations

import io
import re
import zipfile
from typing import Any, Protocol

from ingest.models import DocExport, ExtractedImage

_DOC_ID_IN_URL = re.compile(r"/d/([a-zA-Z0-9_-]+)")


def extract_doc_id(doc_ref: str) -> str:
    """Accepts a full Docs share URL or a bare Doc ID (CONTENT-CONTRACT.md §1)."""
    doc_ref = doc_ref.strip()
    match = _DOC_ID_IN_URL.search(doc_ref)
    if match:
        return match.group(1)
    if not doc_ref:
        raise ValueError("collegamento al documento mancante")
    return doc_ref


class DriveClient(Protocol):
    def export_doc(self, doc_id: str) -> DocExport: ...

    def get_modified_time(self, doc_id: str) -> str: ...

    def download_file(self, file_ref: str) -> bytes: ...


def parse_export_zip(content: bytes) -> DocExport:
    """The `application/zip` export (CONTENT-CONTRACT.md §6) contains the
    Doc's HTML plus every embedded image, unlike the plain `text/markdown`
    export which drops images entirely."""
    html = ""
    images: list[ExtractedImage] = []
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        for name in archive.namelist():
            if name.endswith("/"):
                continue
            data = archive.read(name)
            if name.lower().endswith(".html"):
                html = data.decode("utf-8")
            elif "/" in name:
                images.append(ExtractedImage(filename=name.rsplit("/", 1)[-1], data=data))
    return DocExport(html=html, images=images)


class GoogleDriveClient:
    """Real implementation, backed by the Drive API v3."""

    def __init__(self, service: Any) -> None:
        self._service = service

    def export_doc(self, doc_id: str) -> DocExport:
        content = self._service.files().export(fileId=doc_id, mimeType="application/zip").execute()
        return parse_export_zip(bytes(content))

    def get_modified_time(self, doc_id: str) -> str:
        metadata = self._service.files().get(fileId=doc_id, fields="modifiedTime").execute()
        return str(metadata["modifiedTime"])

    def download_file(self, file_ref: str) -> bytes:
        file_id = extract_doc_id(file_ref)
        content = self._service.files().get_media(fileId=file_id).execute()
        return bytes(content)
