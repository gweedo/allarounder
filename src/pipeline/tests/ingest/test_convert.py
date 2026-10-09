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

    def test_converts_google_docs_class_italic(self) -> None:
        # Google Docs' HTML export never uses <em>/<strong>: it defines CSS
        # classes in <style> and applies them to spans. Shape taken from a
        # real export (the first published article lost its italics).
        html = (
            '<html><head><style type="text/css">'
            ".c1{font-weight:400;font-style:normal}"
            ".c4{font-style:italic;font-weight:400}"
            "</style></head><body>"
            '<p class="c0"><span class="c1">“</span>'
            '<span class="c4">Non avere paura di fallire</span>'
            '<span class="c1">”.</span></p></body></html>'
        )
        assert html_to_markdown(html) == "“*Non avere paura di fallire*”."

    def test_converts_google_docs_class_bold(self) -> None:
        html = (
            "<html><head><style>.c2{font-weight:700}.c1{font-weight:400}</style></head>"
            '<body><p><span class="c1">Un </span><span class="c2">punto</span>'
            '<span class="c1"> chiave.</span></p></body></html>'
        )
        assert html_to_markdown(html) == "Un **punto** chiave."

    def test_converts_google_docs_class_bold_italic(self) -> None:
        html = (
            "<html><head><style>.c3{font-weight:700;font-style:italic}</style></head>"
            '<body><p>sono <span class="c3">entrambi</span> qui</p></body></html>'
        )
        assert html_to_markdown(html) == "sono ***entrambi*** qui"

    def test_does_not_bold_headings(self) -> None:
        # Docs styles heading text bold too; "## **Titolo**" would be noise.
        html = (
            "<html><head><style>.c2{font-weight:700}</style></head>"
            '<body><h2><span class="c2">Allenarsi alla vita</span></h2></body></html>'
        )
        assert html_to_markdown(html) == "## Allenarsi alla vita"

    def test_converts_inline_style_italic(self) -> None:
        html = '<p><span style="font-style:italic">corsivo</span> normale</p>'
        assert html_to_markdown(html) == "*corsivo* normale"

    def test_keeps_whitespace_outside_emphasis_markers(self) -> None:
        # "* parola*" is not valid Markdown emphasis; spaces Docs puts inside
        # the styled span must end up outside the markers.
        html = (
            "<html><head><style>.c4{font-style:italic}</style></head>"
            '<body><p>una<span class="c4"> parola </span>qui</p></body></html>'
        )
        assert html_to_markdown(html) == "una *parola* qui"

    def test_unwraps_google_redirect_links(self) -> None:
        # Real Docs export: every link goes through google.com/url with
        # tracking parameters, which must not reach the published article.
        html = (
            '<p><a href="https://www.google.com/url?q=https://example.com/pagina'
            '&amp;sa=D&amp;source=editors&amp;ust=1791552787980699&amp;usg=AOvVaw3P">'
            "un link</a></p>"
        )
        assert html_to_markdown(html) == "[un link](https://example.com/pagina)"

    def test_unwrapped_link_keeps_its_own_query_string(self) -> None:
        html = (
            '<p><a href="https://www.google.com/url?q=https://www.youtube.com/watch?v%3Dcwak%26t%3D4035s'
            '&amp;sa=D&amp;source=editors">video</a></p>'
        )
        assert html_to_markdown(html) == "[video](https://www.youtube.com/watch?v=cwak&t=4035s)"

    def test_leaves_ordinary_links_untouched(self) -> None:
        html = '<p><a href="https://open.spotify.com/episode/abc?si=1">ep</a></p>'
        assert html_to_markdown(html) == "[ep](https://open.spotify.com/episode/abc?si=1)"

    def test_bold_only_short_line_becomes_section_heading(self) -> None:
        # Writers mark section titles by bolding a line, not with "Titolo 2"
        # (real export shape: inline-styled span inside a <p>).
        html = (
            '<p><span style="font-weight:700">L’inganno moderno del benessere</span></p>'
            "<p>Tra i tanti temi...</p>"
        )
        assert html_to_markdown(html) == "## L’inganno moderno del benessere\n\nTra i tanti temi..."

    def test_section_heading_may_contain_a_colon(self) -> None:
        html = '<p><span style="font-weight:700">Agonismo: sfidare sé stessi</span></p>'
        assert html_to_markdown(html) == "## Agonismo: sfidare sé stessi"

    def test_class_styled_bold_line_becomes_section_heading(self) -> None:
        html = (
            "<html><head><style>.c2{font-weight:700}</style></head><body>"
            '<p class="c0"><span class="c2">La biologia della tenacia</span></p>'
            "</body></html>"
        )
        assert html_to_markdown(html) == "## La biologia della tenacia"

    def test_bold_sentence_ending_in_punctuation_stays_a_paragraph(self) -> None:
        html = '<p><span style="font-weight:700">Questa frase è importante.</span></p>'
        assert html_to_markdown(html) == "**Questa frase è importante.**"

    def test_partly_bold_paragraph_stays_a_paragraph(self) -> None:
        html = (
            '<p><span style="font-weight:700">Nota</span>'
            "<span> che il resto non è grassetto</span></p>"
        )
        assert html_to_markdown(html) == "**Nota** che il resto non è grassetto"

    def test_long_bold_line_stays_a_paragraph(self) -> None:
        text = "parola " * 30  # > 120 characters
        html = f'<p><span style="font-weight:700">{text.strip()}</span></p>'
        assert html_to_markdown(html) == f"**{text.strip()}**"

    def test_existing_docs_headings_are_unchanged(self) -> None:
        html = (
            "<html><head><style>.c2{font-weight:700}</style></head><body>"
            '<h2><span class="c2">Allenarsi alla vita</span></h2></body></html>'
        )
        assert html_to_markdown(html) == "## Allenarsi alla vita"

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
