const { buildNewArticleRow, requireArticlesFolderId } = require("../src/NewArticle");
const { COLUMN_ORDER } = require("../src/Columns");

describe("buildNewArticleRow", () => {
  it("produces a row matching COLUMN_ORDER length and column positions", () => {
    const row = buildNewArticleRow("Titolo di prova", "https://docs.google.com/document/d/abc123/edit");

    expect(row).toHaveLength(COLUMN_ORDER.length);
    expect(row[COLUMN_ORDER.indexOf("titolo")]).toBe("Titolo di prova");
    expect(row[COLUMN_ORDER.indexOf("doc")]).toBe("https://docs.google.com/document/d/abc123/edit");
    expect(row[COLUMN_ORDER.indexOf("stato")]).toBe("Bozza");
  });

  it("leaves every other column blank for the writer to fill in", () => {
    const row = buildNewArticleRow("Titolo", "https://docs.google.com/document/d/xyz/edit");
    const skip = new Set(["titolo", "doc", "stato"]);

    COLUMN_ORDER.forEach((name, i) => {
      if (!skip.has(name)) {
        expect(row[i]).toBe("");
      }
    });
  });
});

describe("requireArticlesFolderId", () => {
  const props = (values) => ({ getProperty: (key) => (key in values ? values[key] : null) });

  it("returns the configured folder ID", () => {
    expect(requireArticlesFolderId(props({ ARTICLES_FOLDER_ID: "folder-123" }))).toBe("folder-123");
  });

  it("trims surrounding whitespace pasted with the ID", () => {
    expect(requireArticlesFolderId(props({ ARTICLES_FOLDER_ID: "  folder-123\n" }))).toBe("folder-123");
  });

  it("throws an Italian error naming the property when it is missing", () => {
    expect(() => requireArticlesFolderId(props({}))).toThrow(/ARTICLES_FOLDER_ID/);
    expect(() => requireArticlesFolderId(props({}))).toThrow(/Proprietà dello script mancante/);
  });

  it("treats a blank value as missing", () => {
    expect(() => requireArticlesFolderId(props({ ARTICLES_FOLDER_ID: "   " }))).toThrow(/ARTICLES_FOLDER_ID/);
  });
});
