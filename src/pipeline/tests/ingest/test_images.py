from pathlib import Path

from ingest.images import write_cover_image, write_inline_images
from ingest.models import ExtractedImage


class TestWriteCoverImage:
    def test_writes_under_public_images_slug(self, tmp_path: Path) -> None:
        url = write_cover_image(tmp_path, "mio-slug", ExtractedImage("original.png", b"data"))
        assert url == "/images/mio-slug/cover.png"
        assert (tmp_path / "images" / "mio-slug" / "cover.png").read_bytes() == b"data"

    def test_lowercases_extension(self, tmp_path: Path) -> None:
        url = write_cover_image(tmp_path, "s", ExtractedImage("PHOTO.JPG", b"data"))
        assert url == "/images/s/cover.jpg"

    def test_defaults_to_png_without_extension(self, tmp_path: Path) -> None:
        url = write_cover_image(tmp_path, "s", ExtractedImage("noext", b"data"))
        assert url == "/images/s/cover.png"


class TestWriteInlineImages:
    def test_writes_sequential_files_and_returns_mapping(self, tmp_path: Path) -> None:
        images = [ExtractedImage("a.png", b"1"), ExtractedImage("b.jpg", b"2")]
        mapping = write_inline_images(tmp_path, "mio-slug", images)
        assert mapping == {"a.png": "/images/mio-slug/1.png", "b.jpg": "/images/mio-slug/2.jpg"}
        assert (tmp_path / "images" / "mio-slug" / "1.png").read_bytes() == b"1"
        assert (tmp_path / "images" / "mio-slug" / "2.jpg").read_bytes() == b"2"

    def test_empty_list_writes_nothing(self, tmp_path: Path) -> None:
        assert write_inline_images(tmp_path, "mio-slug", []) == {}
        assert not (tmp_path / "images").exists()
