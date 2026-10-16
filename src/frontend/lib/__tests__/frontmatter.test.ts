import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { parseFrontmatter } from "../frontmatter";

// Frozen snapshots of the content files committed when gray-matter was
// replaced, with what gray-matter 4.0.3 returned for each: its `data`, and
// the offset in the file where its `content` began (content ran to the end).
const FIXTURES = path.join(__dirname, "fixtures", "frontmatter");
const GOLDEN: Record<string, { data: unknown; contentStart: number }> = JSON.parse(
  fs.readFileSync(path.join(FIXTURES, "gray-matter-golden.json"), "utf-8"),
);

describe("parseFrontmatter parity with gray-matter", () => {
  it("covers every fixture", () => {
    const fixtures = fs.readdirSync(FIXTURES).filter((f) => f.endsWith(".md"));
    expect(fixtures.sort()).toEqual(Object.keys(GOLDEN).sort());
  });

  it.each(Object.keys(GOLDEN))("parses %s like gray-matter did", (name) => {
    const raw = fs.readFileSync(path.join(FIXTURES, name), "utf-8");
    const { data, contentStart } = GOLDEN[name];

    expect(parseFrontmatter(raw)).toEqual({ data, content: raw.slice(contentStart) });
  });
});

// The fixtures above are frozen; this keeps content the pipeline publishes
// later covered by a basic check. A directory git dropped when empty is skipped.
const CONTENT = path.join(__dirname, "..", "..", "content");
const LIVE = ["articles", "pages"]
  .filter((dir) => fs.existsSync(path.join(CONTENT, dir)))
  .flatMap((dir) =>
    fs
      .readdirSync(path.join(CONTENT, dir))
      .filter((f) => f.endsWith(".md"))
      .map((f) => path.join(dir, f)),
  );

describe("parseFrontmatter on the committed content", () => {
  it.each(LIVE)("reads %s into a slug matching its file name", (file) => {
    const { data } = parseFrontmatter(fs.readFileSync(path.join(CONTENT, file), "utf-8"));

    expect(data.slug).toBe(path.basename(file, ".md"));
  });
});

describe("parseFrontmatter", () => {
  it("splits the leading YAML block into data and returns the rest as content", () => {
    const raw = "---\ntitle: Chi siamo\nslug: chi-siamo\n---\nCorpo del testo.\n";

    expect(parseFrontmatter(raw)).toEqual({
      data: { title: "Chi siamo", slug: "chi-siamo" },
      content: "Corpo del testo.\n",
    });
  });

  it("ignores a leading UTF-8 byte order mark", () => {
    expect(parseFrontmatter("\uFEFF---\ntitle: Ciao\n---\nCorpo\n")).toEqual({
      data: { title: "Ciao" },
      content: "Corpo\n",
    });
  });

  it("handles CRLF line endings, keeping them in the body", () => {
    const raw = "---\r\ntitle: Ciao\r\nslug: ciao\r\n---\r\nRiga uno\r\nRiga due\r\n";

    expect(parseFrontmatter(raw)).toEqual({
      data: { title: "Ciao", slug: "ciao" },
      content: "Riga uno\r\nRiga due\r\n",
    });
  });

  it("returns empty data and the whole text when there is no frontmatter", () => {
    const raw = "Solo testo, nessun frontmatter.\n\n---\n\nAltro testo.\n";

    expect(parseFrontmatter(raw)).toEqual({ data: {}, content: raw });
  });

  it.each([
    ["no lines", "---\n---\nCorpo\n"],
    ["a blank line", "---\n\n---\nCorpo\n"],
  ])("returns empty data for an empty frontmatter block (%s)", (_label, raw) => {
    expect(parseFrontmatter(raw)).toEqual({ data: {}, content: "Corpo\n" });
  });

  it("keeps a quoted ISO date as a string", () => {
    const { data } = parseFrontmatter("---\nupdated_at: '2026-10-09T13:28:55.060Z'\n---\n");

    expect(data.updated_at).toBe("2026-10-09T13:28:55.060Z");
  });

  it("parses unquoted ISO timestamps and dates as Date, as gray-matter's js-yaml 3 did", () => {
    const { data } = parseFrontmatter(
      "---\nupdated_at: 2026-10-09T13:28:55.060Z\nday: 2026-10-09\n---\n",
    );

    expect(data.updated_at).toEqual(new Date("2026-10-09T13:28:55.060Z"));
    expect(data.day).toEqual(new Date("2026-10-09T00:00:00.000Z"));
  });

  it("closes the block at the first delimiter, keeping later --- rules in the body", () => {
    expect(parseFrontmatter("---\ntitle: x\n---\nA\n\n---\n\nB\n")).toEqual({
      data: { title: "x" },
      content: "A\n\n---\n\nB\n",
    });
  });

  it.each([
    ["no closing line", "---\ntitle: x\n"],
    ["no closing line (a body that opens with a --- rule)", "---\n\nIntroduzione.\n"],
    ["a closing line longer than ---", "---\ntitle: x\n----\nCorpo\n"],
    ["text after the closing ---", "---\ntitle: x\n--- # fine\n---\nCorpo\n"],
  ])("rejects a block with %s", (_label, raw) => {
    expect(() => parseFrontmatter(raw)).toThrow(/closing/);
  });

  it.each([
    ["a scalar", "---\nsolo testo\n---\nCorpo\n"],
    ["a list", "---\n- a\n- b\n---\nCorpo\n"],
  ])("rejects frontmatter that is %s rather than a mapping", (_label, raw) => {
    expect(() => parseFrontmatter(raw)).toThrow(/mapping/);
  });

  it("accepts trailing spaces after the opening and closing delimiters", () => {
    expect(parseFrontmatter("--- \ntitle: x\n---\t\nCorpo\n")).toEqual({
      data: { title: "x" },
      content: "Corpo\n",
    });
  });

  it.each([
    ["a ---js language tag", "---js\nmodule.exports = {};\n---\nCorpo\n"],
    ["a ---yaml language tag", "---yaml\ntitle: x\n---\nCorpo\n"],
    ["other text after ---", "--- -x\ntitle: x\n---\nCorpo\n"],
    ["a non-breaking space after ---", "---\u00a0\ntitle: x\n---\nCorpo\n"],
    ["--- alone", "---"],
  ])("rejects an opening line with %s instead of evaluating or ignoring it", (_label, raw) => {
    expect(() => parseFrontmatter(raw)).toThrow(/opening line/);
  });

  it("treats a first line of four or more dashes as body, not frontmatter", () => {
    const raw = "----\nCorpo\n";

    expect(parseFrontmatter(raw)).toEqual({ data: {}, content: raw });
  });
});
