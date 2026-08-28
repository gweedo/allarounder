const { COLUMN_ORDER, CATEGORIES, STATI, getColumnIndex } = require("../src/Columns");

describe("COLUMN_ORDER", () => {
  it("matches CONTENT-CONTRACT.md §1 exactly, in order", () => {
    expect(COLUMN_ORDER).toEqual([
      "titolo",
      "doc",
      "categoria",
      "tag",
      "autore",
      "ospite",
      "spotify",
      "copertina",
      "meta_description",
      "data",
      "stato",
      "esito",
    ]);
  });
});

describe("getColumnIndex", () => {
  it("is 1-indexed, matching Sheet.getRange()", () => {
    expect(getColumnIndex("titolo")).toBe(1);
    expect(getColumnIndex("esito")).toBe(12);
  });

  it("throws on an unknown column", () => {
    expect(() => getColumnIndex("nope")).toThrow();
  });
});

describe("CATEGORIES", () => {
  it("matches the four seeded categories", () => {
    expect(CATEGORIES).toEqual(["Interviste", "Analisi", "Roundtable", "Out of the Box"]);
  });
});

describe("STATI", () => {
  it("matches the three editorial states", () => {
    expect(STATI).toEqual(["Bozza", "Pronto", "Pubblicato"]);
  });
});
