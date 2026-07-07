import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { convertHtmlToMarkdown } from "../html-to-markdown";

function fixture(name: string): string {
  return readFileSync(join(__dirname, "fixtures", name), "utf-8");
}

describe("convertHtmlToMarkdown - Google Docs fixtures", () => {
  it("converts headings, bold/italic runs, and a link (gdocs-basic.html)", async () => {
    const { markdown, externalImages } = await convertHtmlToMarkdown(
      fixture("gdocs-basic.html"),
    );
    expect(markdown).toBe(
      "# Titolo principale\n\n" +
        "Questo è un paragrafo con testo **grassetto** e testo _corsivo_ nella stessa frase.\n\n" +
        "Ecco un link a [un sito esterno](https://www.example.com/).\n\n" +
        "## Un sottotitolo\n\n" +
        "Un paragrafo finale con testo **_grassetto e corsivo insieme_**.",
    );
    expect(externalImages).toEqual([]);
  });

  it("converts nested bullet + numbered lists as tight lists (gdocs-lists.html)", async () => {
    const { markdown, externalImages } = await convertHtmlToMarkdown(
      fixture("gdocs-lists.html"),
    );
    expect(markdown).toBe(
      "- Primo elemento\n\n" +
        "- Secondo elemento con una sotto-lista\n\n" +
        "  - Sotto-elemento uno\n" +
        "  - Sotto-elemento due\n\n" +
        "- Terzo elemento\n\n" +
        "1. Primo passo\n" +
        "2. Secondo passo",
    );
    expect(externalImages).toEqual([]);
    // The key behavior this fixture guards: no list item renders as a bare
    // bullet marker followed by a blank line then indented text (the bug
    // that motivated unwrapping <li><p>).
    expect(markdown).not.toMatch(/^- $/m);
  });

  it("converts an inline image + caption and collects the googleusercontent URL (gdocs-image.html)", async () => {
    const { markdown, externalImages } = await convertHtmlToMarkdown(
      fixture("gdocs-image.html"),
    );
    expect(markdown).toBe(
      "![](https://lh7-us.googleusercontent.com/AbCdEfGhIjKlMnOpQrStUvWxYz1234567890-abcdefg/w624-h351)\n\n" +
        "_Didascalia dell'immagine di esempio._",
    );
    expect(externalImages).toEqual([
      "https://lh7-us.googleusercontent.com/AbCdEfGhIjKlMnOpQrStUvWxYz1234567890-abcdefg/w624-h351",
    ]);
  });
});

describe("convertHtmlToMarkdown - unit behaviors", () => {
  it("unwraps the docs-internal-guid wrapper <b> instead of treating it as bold", async () => {
    const { markdown } = await convertHtmlToMarkdown(
      '<b style="font-weight:normal" id="docs-internal-guid-x"><p dir="ltr">Hello</p></b>',
    );
    expect(markdown).toBe("Hello");
  });

  it("maps font-weight:700 spans to **bold**", async () => {
    const { markdown } = await convertHtmlToMarkdown(
      '<p><span style="font-weight:700">Bold</span> text</p>',
    );
    expect(markdown).toBe("**Bold** text");
  });

  it("maps font-weight:600 (>=600 threshold) spans to **bold**", async () => {
    const { markdown } = await convertHtmlToMarkdown(
      '<p><span style="font-weight:600">Semibold</span> text</p>',
    );
    expect(markdown).toBe("**Semibold** text");
  });

  it("does not bold spans below the 600 weight threshold", async () => {
    const { markdown } = await convertHtmlToMarkdown(
      '<p><span style="font-weight:400">Regular</span> text</p>',
    );
    expect(markdown).toBe("Regular text");
  });

  it("maps font-style:italic spans to _italic_", async () => {
    const { markdown } = await convertHtmlToMarkdown(
      '<p><span style="font-style:italic">Italic</span> text</p>',
    );
    expect(markdown).toBe("_Italic_ text");
  });

  it("maps bold+italic spans to nested **_text_**", async () => {
    const { markdown } = await convertHtmlToMarkdown(
      '<p><span style="font-weight:700;font-style:italic">Both</span> text</p>',
    );
    expect(markdown).toBe("**_Both_** text");
  });

  it("unwraps plain (unstyled) spans without adding emphasis", async () => {
    const { markdown } = await convertHtmlToMarkdown(
      '<p><span style="font-size:11pt;color:#000">Plain</span> text</p>',
    );
    expect(markdown).toBe("Plain text");
  });

  it("does not bold a real heading's text just because its span carries font-weight:700", async () => {
    const { markdown } = await convertHtmlToMarkdown(
      '<h1><span style="font-weight:700">Titolo</span></h1>',
    );
    expect(markdown).toBe("# Titolo");
  });

  it("strips empty paragraphs (&nbsp; only, <br> only) but keeps real content", async () => {
    const { markdown } = await convertHtmlToMarkdown(
      "<p><span>&nbsp;</span></p><p><br></p><p>Real content</p>",
    );
    expect(markdown).toBe("Real content");
  });

  it("collects only googleusercontent.com image URLs into externalImages", async () => {
    const { markdown, externalImages } = await convertHtmlToMarkdown(
      '<p><img src="https://lh7-us.googleusercontent.com/abc"><img src="https://example.com/other.png"></p>',
    );
    expect(externalImages).toEqual(["https://lh7-us.googleusercontent.com/abc"]);
    // Both images are left in the markdown for later URL rewriting.
    expect(markdown).toContain("https://lh7-us.googleusercontent.com/abc");
    expect(markdown).toContain("https://example.com/other.png");
  });

  it("passes plain (non-Docs) rich HTML through using semantic tags", async () => {
    const { markdown, externalImages } = await convertHtmlToMarkdown(
      "<p>Hello <strong>world</strong> and <em>emphasis</em></p>",
    );
    expect(markdown).toBe("Hello **world** and _emphasis_");
    expect(externalImages).toEqual([]);
  });

  it("converts <br> line breaks inside a paragraph", async () => {
    const { markdown } = await convertHtmlToMarkdown("<p>Line one<br>Line two</p>");
    expect(markdown).toBe("Line one\\\nLine two");
  });

  it("never lets <script> content reach the output markdown (XSS)", async () => {
    const { markdown } = await convertHtmlToMarkdown(
      "<p>Hello</p><script>alert(document.cookie)</script>",
    );
    expect(markdown).toBe("Hello");
    expect(markdown).not.toContain("script");
    expect(markdown).not.toContain("alert");
  });

  it("never lets an inline event-handler attribute reach the output (XSS)", async () => {
    const { markdown } = await convertHtmlToMarkdown(
      '<p><img src="https://example.com/x.png" onerror="alert(1)"></p>',
    );
    expect(markdown).not.toContain("onerror");
    expect(markdown).not.toContain("alert");
  });
});
