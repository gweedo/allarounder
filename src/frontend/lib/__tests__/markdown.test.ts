import { describe, it, expect, beforeAll } from "vitest";
import { renderMarkdown } from "../markdown";

// Characterization tests: these pin the exact HTML output of the shared
// remark -> rehype (allowDangerousHtml: false) -> rehype-sanitize -> rehype-stringify
// pipeline as it behaved before extraction into lib/markdown.ts. Expected values
// were captured by running the pre-extraction pipeline verbatim against each input.

describe("renderMarkdown", () => {
  // The dynamic imports inside renderMarkdown pay a one-time cold-load cost
  // for the remark/rehype pipeline; pay it here so it doesn't blow the
  // default per-test timeout on whichever test happens to run first.
  beforeAll(async () => {
    await renderMarkdown("");
  }, 20000);

  it("renders a heading", async () => {
    const html = await renderMarkdown("# Titolo\n\n## Sottotitolo");
    expect(html).toBe("<h1>Titolo</h1>\n<h2>Sottotitolo</h2>");
  });

  it("renders a paragraph", async () => {
    const html = await renderMarkdown("Questo è un paragrafo semplice.");
    expect(html).toBe("<p>Questo è un paragrafo semplice.</p>");
  });

  it("renders bold and italic (both ** / __ and * / _ styles)", async () => {
    const html = await renderMarkdown(
      "Testo **grassetto** e _corsivo_ e anche __altro grassetto__ e *altro corsivo*.",
    );
    expect(html).toBe(
      "<p>Testo <strong>grassetto</strong> e <em>corsivo</em> e anche <strong>altro grassetto</strong> e <em>altro corsivo</em>.</p>",
    );
  });

  it("renders a link", async () => {
    const html = await renderMarkdown("Vai su [Allarounder](https://allarounder.it).");
    expect(html).toBe('<p>Vai su <a href="https://allarounder.it">Allarounder</a>.</p>');
  });

  it("renders an unordered list", async () => {
    const html = await renderMarkdown("- uno\n- due\n- tre");
    expect(html).toBe("<ul>\n<li>uno</li>\n<li>due</li>\n<li>tre</li>\n</ul>");
  });

  it("renders an ordered list", async () => {
    const html = await renderMarkdown("1. uno\n2. due\n3. tre");
    expect(html).toBe("<ol>\n<li>uno</li>\n<li>due</li>\n<li>tre</li>\n</ol>");
  });

  it("renders a nested list", async () => {
    const html = await renderMarkdown("- uno\n  - uno-a\n  - uno-b\n- due");
    expect(html).toBe(
      "<ul>\n<li>uno\n<ul>\n<li>uno-a</li>\n<li>uno-b</li>\n</ul>\n</li>\n<li>due</li>\n</ul>",
    );
  });

  it("renders a blockquote", async () => {
    const html = await renderMarkdown("> Una citazione\n> su due righe");
    expect(html).toBe("<blockquote>\n<p>Una citazione\nsu due righe</p>\n</blockquote>");
  });

  it("renders an image", async () => {
    const html = await renderMarkdown("![alt text](https://cdn.allarounder.it/img.jpg)");
    expect(html).toBe('<p><img src="https://cdn.allarounder.it/img.jpg" alt="alt text"></p>');
  });

  it("renders inline code", async () => {
    const html = await renderMarkdown("Usa `const x = 1` nel codice.");
    expect(html).toBe("<p>Usa <code>const x = 1</code> nel codice.</p>");
  });

  it("renders fenced code with language class", async () => {
    const html = await renderMarkdown("```js\nconst x = 1;\nconsole.log(x);\n```");
    expect(html).toBe(
      '<pre><code class="language-js">const x = 1;\nconsole.log(x);\n</code></pre>',
    );
  });

  it("strips <script> tags on their own line, keeping surrounding paragraphs", async () => {
    const html = await renderMarkdown(
      "Testo prima\n\n<script>alert('xss')</script>\n\nTesto dopo",
    );
    expect(html).toBe("<p>Testo prima</p>\n<p>Testo dopo</p>");
  });

  it("strips a raw HTML element carrying an onerror attribute entirely", async () => {
    const html = await renderMarkdown('<img src="x" onerror="alert(1)">');
    expect(html).toBe("");
  });

  it("strips raw HTML block elements from markdown", async () => {
    const html = await renderMarkdown('<div class="custom"><strong>bold via html</strong></div>');
    expect(html).toBe("");
  });

  it("strips javascript: URLs from links, keeping the link text", async () => {
    const html = await renderMarkdown("[click me](javascript:alert('xss'))");
    expect(html).toBe("<p><a>click me</a></p>");
  });

  it("strips an inline <script> tag within a paragraph, keeping surrounding text", async () => {
    const html = await renderMarkdown("Ciao <script>alert(1)</script> mondo");
    expect(html).toBe("<p>Ciao alert(1) mondo</p>");
  });
});
