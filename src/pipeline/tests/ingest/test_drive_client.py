import io
import zipfile

import pytest

from ingest.drive_client import extract_doc_id, parse_export_zip


class TestExtractDocId:
    def test_extracts_from_full_share_url(self) -> None:
        url = "https://docs.google.com/document/d/1AbCdEf23456/edit"
        assert extract_doc_id(url) == "1AbCdEf23456"

    def test_accepts_bare_id(self) -> None:
        assert extract_doc_id("1AbCdEf23456") == "1AbCdEf23456"

    def test_strips_whitespace_on_bare_id(self) -> None:
        assert extract_doc_id("  1AbCdEf23456  ") == "1AbCdEf23456"

    def test_rejects_empty(self) -> None:
        with pytest.raises(ValueError):
            extract_doc_id("")


def _build_export_zip(html: str, images: dict[str, bytes]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("Intervista a Marco.html", html)
        for name, data in images.items():
            archive.writestr(f"images/{name}", data)
    return buffer.getvalue()


class TestParseExportZip:
    def test_extracts_html_and_images(self) -> None:
        content = _build_export_zip(
            "<p>Corpo</p>", {"image1.png": b"fake-png-bytes", "image2.jpg": b"fake-jpg-bytes"}
        )
        export = parse_export_zip(content)
        assert export.html == "<p>Corpo</p>"
        filenames = {image.filename for image in export.images}
        assert filenames == {"image1.png", "image2.jpg"}

    def test_zip_with_no_images(self) -> None:
        content = _build_export_zip("<p>Solo testo</p>", {})
        export = parse_export_zip(content)
        assert export.html == "<p>Solo testo</p>"
        assert export.images == []
