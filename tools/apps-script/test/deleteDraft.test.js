const { draftDeletionBlocker, extractDocId } = require("../src/DeleteDraft");

describe("draftDeletionBlocker", () => {
  it("allows a Bozza row that never ran through the pipeline", () => {
    expect(draftDeletionBlocker("Bozza", "")).toBeNull();
  });

  it("allows a Pronto row", () => {
    expect(draftDeletionBlocker("Pronto", "")).toBeNull();
  });

  it("allows a draft whose last run failed validation", () => {
    expect(draftDeletionBlocker("Bozza", "✗ categoria mancante")).toBeNull();
  });

  it("refuses a Pubblicato row, even if it has not gone live yet", () => {
    expect(draftDeletionBlocker("Pubblicato", "")).toMatch(/Pubblicato/);
    expect(draftDeletionBlocker("Pubblicato", "⏳ Programmato per 2026-12-01")).toMatch(/Pubblicato/);
  });

  it("refuses a row that was published before, whatever its stato is now", () => {
    // Un-publishing is out of scope (CONTENT-CONTRACT.md §3): content stays
    // live after stato changes, so deleting the row would orphan it.
    expect(draftDeletionBlocker("Bozza", "✓ Pubblicato 14:32")).toMatch(/già pubblicato/);
  });

  it("ignores surrounding whitespace in stato and esito", () => {
    expect(draftDeletionBlocker(" Pubblicato ", "")).toMatch(/Pubblicato/);
    expect(draftDeletionBlocker("Bozza", "  ✓ Pubblicato 14:32")).toMatch(/già pubblicato/);
  });
});

describe("extractDocId", () => {
  it("reads the ID from Document.getUrl()'s open?id= form", () => {
    expect(extractDocId("https://docs.google.com/open?id=1AbC-d_E")).toBe("1AbC-d_E");
  });

  it("reads the ID from a /d/<id>/edit share URL", () => {
    expect(extractDocId("https://docs.google.com/document/d/1AbC-d_E/edit")).toBe("1AbC-d_E");
  });

  it("accepts a bare ID", () => {
    expect(extractDocId("  1AbC-d_E ")).toBe("1AbC-d_E");
  });

  it("returns null for an empty cell or a URL without an ID", () => {
    expect(extractDocId("")).toBeNull();
    expect(extractDocId("https://docs.google.com/document/u/0/")).toBeNull();
  });
});
