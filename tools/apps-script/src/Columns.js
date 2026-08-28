// Column order for the editorial Sheet, per docs/architecture/CONTENT-CONTRACT.md §1.
// This order is load-bearing: getColumnIndex() below assumes it matches the
// real Sheet's column layout exactly.
var COLUMN_ORDER = [
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
];

// The four categories seeded per CONTENT-CONTRACT.md §1 / PRD "Category" model.
var CATEGORIES = ["Interviste", "Analisi", "Roundtable", "Out of the Box"];

// The three editorial states per CONTENT-CONTRACT.md §1.
var STATI = ["Bozza", "Pronto", "Pubblicato"];

// Hand-maintained copy of src/pipeline/data/authors.json's author names
// (Stream 1 owns that file; this is the Sheet-side dropdown list). Per
// CONTENT-CONTRACT.md §4, autore is strict — the pipeline rejects a row
// whose autore doesn't match the registry — so this list should stay in
// sync with authors.json by hand whenever an author is added there. There
// is no automation linking the two files in v1.
var AUTORI = ["Guido S."];

// 1-indexed column number for a given column name, for use with
// Sheet.getRange(row, col, ...).
function getColumnIndex(name) {
  var idx = COLUMN_ORDER.indexOf(name);
  if (idx === -1) {
    throw new Error("Unknown column: " + name);
  }
  return idx + 1;
}

// Apps Script has no module system (no require/module.exports at runtime),
// but guarding the export like this lets the same file run unmodified in
// both the Apps Script editor and Jest under Node.
if (typeof module !== "undefined") {
  module.exports = { COLUMN_ORDER, CATEGORIES, STATI, AUTORI, getColumnIndex };
}
