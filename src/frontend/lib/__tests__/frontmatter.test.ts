import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { parseFrontmatter } from "../frontmatter";

// Snapshots of the committed content files, plus the { data, content } that
// gray-matter 4.0.3 produced for each one before it was replaced.
const FIXTURES = path.join(__dirname, "fixtures", "frontmatter");
const GOLDEN: Record<string, unknown> = JSON.parse(
  fs.readFileSync(path.join(FIXTURES, "gray-matter-golden.json"), "utf-8"),
);

describe("parseFrontmatter parity with gray-matter", () => {
  it("covers every fixture", () => {
    const fixtures = fs.readdirSync(FIXTURES).filter((f) => f.endsWith(".md"));
    expect(fixtures.sort()).toEqual(Object.keys(GOLDEN).sort());
  });

  it.each(Object.keys(GOLDEN))("parses %s like gray-matter did", (name) => {
    const raw = fs.readFileSync(path.join(FIXTURES, name), "utf-8");
    expect(parseFrontmatter(raw)).toEqual(GOLDEN[name]);
  });
});

// The fixtures above are frozen; this keeps content the pipeline publishes
// later covered by a basic check.
const CONTENT = path.join(__dirname, "..", "..", "content");
const LIVE = ["articles", "pages"].flatMap((dir) =>
  fs
    .readdirSync(path.join(CONTENT, dir))
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(dir, f)),
);

describe("parseFrontmatter on the committed content", () => {
  it.each(LIVE)("reads %s into a slug matching its file name and a body", (file) => {
    const { data, content } = parseFrontmatter(
      fs.readFileSync(path.join(CONTENT, file), "utf-8"),
    );

    expect(data.slug).toBe(path.basename(file, ".md"));
    expect(content.trim()).not.toBe("");
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

  it("treats an unclosed block as all frontmatter and no body, as gray-matter did", () => {
    expect(parseFrontmatter("---\ntitle: x\n")).toEqual({ data: { title: "x" }, content: "" });
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

  it.each(["---js", "---yaml"])(
    "rejects a %s language opener instead of evaluating or ignoring it",
    (opener) => {
      expect(() => parseFrontmatter(`${opener}\ntitle: x\n---\nCorpo\n`)).toThrow(/language/);
    },
  );
});
