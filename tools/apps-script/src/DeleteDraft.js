// "Elimina bozza" menu action: moves a never-published article's Doc to the
// Drive trash and deletes its row.
//
// Drafts only. Un-publishing is out of scope (CONTENT-CONTRACT.md §3, §10):
// once an article has gone live, changing or removing its row does not
// retract the committed content, so deleting such a row would only orphan
// a live page. Removing a live article stays a `git revert`.
//
// draftDeletionBlocker(), extractDocId() and linkFromCellData() are pure and
// tested; handleEliminaBozza() and readDocRef() call SpreadsheetApp/DriveApp/
// the Sheets advanced service and are not unit-testable outside the Apps
// Script runtime.

function handleEliminaBozza() {
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSheet();
  var row = sheet.getActiveCell().getRow();

  if (row === 1) {
    ui.alert("Seleziona una riga di articolo, non l'intestazione.");
    return;
  }

  var values = sheet.getRange(row, 1, 1, COLUMN_ORDER.length).getValues()[0];
  var titolo = String(values[getColumnIndex("titolo") - 1]);
  var stato = String(values[getColumnIndex("stato") - 1]);
  var esito = String(values[getColumnIndex("esito") - 1]);
  var docRef = readDocRef(sheet, row);

  var blocker = draftDeletionBlocker(stato, esito);
  if (blocker) {
    ui.alert(blocker);
    return;
  }

  var confirm = ui.alert(
    "Elimina bozza",
    'Eliminare "' + titolo + '"?\nIl documento finirà nel cestino di Drive e la riga verrà cancellata.',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) {
    return;
  }

  // Trash the Doc before deleting the row: if trashing fails (in My Drive,
  // only a file's owner can trash it), the row must survive so the Doc is
  // not left behind with nothing pointing at it.
  var docId = extractDocId(docRef);
  if (docId) {
    try {
      DriveApp.getFileById(docId).setTrashed(true);
    } catch (err) {
      ui.alert(
        "Bozza non eliminata: non è stato possibile spostare il documento nel cestino.\n" +
          err.message +
          "\n(Se il documento è di un altro autore, solo il proprietario può eliminarlo.)"
      );
      return;
    }
  }

  sheet.deleteRow(row);
}

// The `doc` cell's link. Sheets turns a pasted Drive URL into a smart chip
// on request, after which getValues() returns only the Doc's title; the URL
// is reachable only through the Sheets API's chipRuns (the advanced Sheets
// service, enabled in appsscript.json).
function readDocRef(sheet, row) {
  var a1 = "'" + sheet.getName().replace(/'/g, "''") + "'!" +
    sheet.getRange(row, getColumnIndex("doc")).getA1Notation();
  var result = Sheets.Spreadsheets.get(sheet.getParent().getId(), {
    ranges: [a1],
    fields: "sheets.data.rowData.values(formattedValue,hyperlink,chipRuns)",
  });
  var rowData = result.sheets[0].data[0].rowData || [];
  var cell = rowData.length && rowData[0].values ? rowData[0].values[0] : undefined;
  return linkFromCellData(cell);
}

// A Sheets API CellData -> the link it holds: a smart chip's URL, else the
// cell's hyperlink, else its displayed value (a pasted URL or bare ID).
// Mirrors the pipeline's cell_text() for link columns.
function linkFromCellData(cell) {
  if (!cell) {
    return "";
  }
  var runs = cell.chipRuns || [];
  for (var i = 0; i < runs.length; i++) {
    var link = runs[i].chip && runs[i].chip.richLinkProperties;
    if (link && link.uri) {
      return String(link.uri);
    }
  }
  if (cell.hyperlink) {
    return String(cell.hyperlink);
  }
  return String(cell.formattedValue || "");
}

// Returns an Italian message explaining why this row must not be deleted,
// or null if it is a draft that is safe to delete.
function draftDeletionBlocker(stato, esito) {
  if (String(esito).trim().indexOf("✓") === 0) {
    return "Questo articolo è già pubblicato sul sito: non può essere eliminato da qui. Chiedi a Guido di ritirarlo.";
  }
  if (String(stato).trim() === "Pubblicato") {
    return 'Lo stato è "Pubblicato": riportalo a "Bozza" prima di eliminare l\'articolo.';
  }
  return null;
}

// The `doc` cell holds Document.getUrl()'s open?id= form, a /d/<id> share
// URL, or a bare ID (CONTENT-CONTRACT.md §1). Mirrors the pipeline's
// extract_doc_id(); returns null when there is no usable ID.
function extractDocId(docRef) {
  var ref = String(docRef).trim();
  var match = ref.match(/\/d\/([a-zA-Z0-9_-]+)/) || ref.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) {
    return match[1];
  }
  if (!ref || ref.indexOf("://") !== -1) {
    return null;
  }
  return ref;
}

if (typeof module !== "undefined") {
  module.exports = { draftDeletionBlocker, extractDocId, linkFromCellData };
}
