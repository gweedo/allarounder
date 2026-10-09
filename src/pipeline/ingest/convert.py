"""HTML -> Markdown conversion for exported Docs (CONTENT-CONTRACT.md §6).

Uses `markdownify` (BeautifulSoup-backed) rather than a hand-rolled parser.
Two Docs export quirks need a pre-pass: italic and bold are never <em>/
<strong> but styles on <span>s (inline, or CSS classes declared in <style>),
so they are rewritten into real emphasis tags; and every link is wrapped in
a google.com/url tracking redirect, which is unwrapped to its target.
"""

from __future__ import annotations

import re
from urllib.parse import parse_qs, urlsplit

from bs4 import BeautifulSoup, Tag
from markdownify import markdownify

_IMAGE_PATTERN = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
_CSS_CLASS_RULE = re.compile(r"\.([\w-]+)\s*\{([^}]*)\}")
_BOLD_WEIGHT = re.compile(r"font-weight:(?:bold|[6-9]00)")
_HEADINGS = ["h1", "h2", "h3", "h4", "h5", "h6"]


def _emphasis(declarations: str) -> tuple[bool, bool]:
    """(italic, bold) for a CSS declaration block."""
    flat = declarations.replace(" ", "").lower()
    return "font-style:italic" in flat, bool(_BOLD_WEIGHT.search(flat))


def _wrap_contents(soup: BeautifulSoup, span: Tag, tag_name: str) -> None:
    wrapper = soup.new_tag(tag_name)
    for child in list(span.contents):
        wrapper.append(child.extract())
    span.append(wrapper)


def _apply_docs_emphasis(soup: BeautifulSoup) -> None:
    class_emphasis: dict[str, tuple[bool, bool]] = {}
    for style in soup.find_all("style"):
        for name, declarations in _CSS_CLASS_RULE.findall(style.get_text()):
            class_emphasis[name] = _emphasis(declarations)

    for span in soup.find_all("span"):
        italic, bold = _emphasis(str(span.get("style", "")))
        for name in span.get("class") or []:
            class_italic, class_bold = class_emphasis.get(name, (False, False))
            italic, bold = italic or class_italic, bold or class_bold
        if span.find_parent(_HEADINGS):
            # Docs styles heading text bold too; "## **Titolo**" is noise.
            bold = False
        if italic:
            _wrap_contents(soup, span, "em")
        if bold:
            _wrap_contents(soup, span, "strong")


def _unwrap_google_redirects(soup: BeautifulSoup) -> None:
    """Docs exports every link as google.com/url?q=<target>&sa=D&usg=...;
    publish the target itself, not Google's tracking redirect."""
    for link in soup.find_all("a", href=True):
        url = urlsplit(str(link["href"]))
        if url.hostname in ("www.google.com", "google.com") and url.path == "/url":
            target = parse_qs(url.query).get("q")
            if target:
                link["href"] = target[0]


def html_to_markdown(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    _apply_docs_emphasis(soup)
    _unwrap_google_redirects(soup)
    markdown = markdownify(str(soup), heading_style="ATX")
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
