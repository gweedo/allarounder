"""Image handling: cover + inline body images (CONTENT-CONTRACT.md §6).

Images are static assets and must live under `src/frontend/public/`, not
`src/frontend/content/` -- `content/` is read via `fs` at build time and is
never copied into the exported `out/` directory, while `public/` is.
"""

from __future__ import annotations

from pathlib import Path

from ingest.models import ExtractedImage


def _extension(filename: str) -> str:
    if "." in filename:
        return filename.rsplit(".", 1)[-1].lower()
    return "png"


def write_cover_image(public_dir: Path, slug: str, image: ExtractedImage) -> str:
    ext = _extension(image.filename)
    target_dir = public_dir / "images" / slug
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"cover.{ext}"
    target.write_bytes(image.data)
    return f"/images/{slug}/cover.{ext}"


def write_inline_images(
    public_dir: Path, slug: str, images: list[ExtractedImage]
) -> dict[str, str]:
    """Returns a mapping of original filename -> public URL, for
    `convert.rewrite_image_links`."""
    if not images:
        return {}
    target_dir = public_dir / "images" / slug
    target_dir.mkdir(parents=True, exist_ok=True)
    mapping: dict[str, str] = {}
    for index, image in enumerate(images, start=1):
        ext = _extension(image.filename)
        target = target_dir / f"{index}.{ext}"
        target.write_bytes(image.data)
        mapping[image.filename] = f"/images/{slug}/{index}.{ext}"
    return mapping
