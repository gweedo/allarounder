"""HTML -> Markdown conversion for exported Docs (CONTENT-CONTRACT.md §6).

Uses `markdownify` (BeautifulSoup-backed) rather than a hand-rolled parser --
Google Docs' exported HTML is simple (headings, paragraphs, bold/italic,
links, images), so no custom conversion rules are needed.
"""

from __future__ import annotations

import re

from markdownify import markdownify

_IMAGE_PATTERN = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")


def html_to_markdown(html: str) -> str:
    markdown = markdownify(html, heading_style="ATX")
    lines = [line.rstrip() for line in markdown.splitlines()]
    collapsed: list[str] = []
    for line in lines:
        if line == "" and collapsed and collapsed[-1] == "":
            continue
        collapsed.append(line)
    return "\n".join(collapsed).strip()


def rewrite_image_links(markdown: str, mapping: dict[str, str]) -> str:
    """Rewrites `![alt](src)` references to the public URLs images were
    written to (CONTENT-CONTRACT.md §6), matching by basename since the
    export zip's image paths and the mapping's keys may differ in prefix."""

    def _replace(match: re.Match[str]) -> str:
        alt, src = match.group(1), match.group(2)
        basename = src.rsplit("/", 1)[-1]
        new_src = mapping.get(basename, mapping.get(src, src))
        return f"![{alt}]({new_src})"

    return _IMAGE_PATTERN.sub(_replace, markdown)
