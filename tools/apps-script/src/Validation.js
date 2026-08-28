// Installs data-validation dropdowns for categoria, stato, and autore, per
// CONTENT-CONTRACT.md §1. ospite has no dropdown — the contract's lenient
// guest creation (§4) means any free text is valid there.
//
// Run manually once per Sheet via the "Configura validazione colonne" menu
// item (not on every onOpen — data validation only needs to be (re)applied
// when the column layout or an allowed-value list changes).
function setupDataValidation() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var lastRow = Math.max(sheet.getMaxRows(), 1000);

  applyDropdown(sheet, getColumnIndex("categoria"), lastRow, CATEGORIES);
  applyDropdown(sheet, getColumnIndex("stato"), lastRow, STATI);
  applyDropdown(sheet, getColumnIndex("autore"), lastRow, AUTORI);
}

function applyDropdown(sheet, col, lastRow, values) {
  var range = sheet.getRange(2, col, lastRow - 1, 1);
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
  range.setDataValidation(rule);
}
