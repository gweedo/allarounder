from ingest.convert import html_to_markdown, rewrite_image_links


class TestHtmlToMarkdown:
    def test_converts_heading_and_paragraph(self) -> None:
        html = "<h1>Titolo</h1><p>Un paragrafo.</p>"
        markdown = html_to_markdown(html)
        assert "# Titolo" in markdown
        assert "Un paragrafo." in markdown

    def test_converts_bold_and_italic(self) -> None:
        html = "<p><strong>forte</strong> e <em>corsivo</em></p>"
        markdown = html_to_markdown(html)
        assert "**forte**" in markdown
        assert "*corsivo*" in markdown

    def test_collapses_blank_line_runs(self) -> None:
        html = "<p>Uno</p><p></p><p></p><p>Due</p>"
        markdown = html_to_markdown(html)
        assert "\n\n\n" not in markdown

    def test_strips_leading_and_trailing_whitespace(self) -> None:
        html = "  <p>Testo</p>  "
        assert html_to_markdown(html) == html_to_markdown(html).strip()


class TestRewriteImageLinks:
    def test_rewrites_matching_basename(self) -> None:
        markdown = "![Alt](images/image1.png)"
        mapping = {"image1.png": "/images/mio-slug/1.png"}
        assert rewrite_image_links(markdown, mapping) == "![Alt](/images/mio-slug/1.png)"

    def test_leaves_unmatched_images_untouched(self) -> None:
        markdown = "![Alt](https://example.com/x.png)"
        assert rewrite_image_links(markdown, {}) == markdown

    def test_rewrites_multiple_images(self) -> None:
        markdown = "![A](images/a.png) testo ![B](images/b.png)"
        mapping = {"a.png": "/images/s/1.png", "b.png": "/images/s/2.png"}
        assert rewrite_image_links(markdown, mapping) == (
            "![A](/images/s/1.png) testo ![B](/images/s/2.png)"
        )
