// "Nuovo articolo" menu action: creates a Doc and a matching draft row.
//
// buildNewArticleRow(), buildArticleOutline() and requireArticlesFolderId()
// are pure and tested; createArticleDoc() and handleNuovoArticolo() call
// DocumentApp/DriveApp/SpreadsheetApp and are not unit-testable outside the
// Apps Script runtime.

function handleNuovoArticolo() {
  var ui = SpreadsheetApp.getUi();

  // Checked before prompting, so a writer never types a title only to hit a
  // configuration error.
  var folderId;
  try {
    folderId = requireArticlesFolderId(PropertiesService.getScriptProperties());
  } catch (err) {
    ui.alert(err.message);
    return;
  }

  var response = ui.prompt("Nuovo articolo", "Titolo dell'articolo:", ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  var titolo = response.getResponseText().trim();
  if (!titolo) {
    ui.alert("Il titolo non può essere vuoto.");
    return;
  }

  var doc = createArticleDoc(titolo, folderId);
  var sheet = SpreadsheetApp.getActiveSheet();
  var row = sheet.getLastRow() + 1;
  var rowValues = buildNewArticleRow(titolo, doc.getUrl());
  sheet.getRange(row, 1, 1, rowValues.length).setValues([rowValues]);

  ui.alert('Bozza creata: "' + titolo + '".\nApri il documento per iniziare a scrivere:\n' + doc.getUrl());
}

// TODO: no real article template Doc has been produced yet (house style,
// per-category section headings, etc. — see docs/product/PRD.md and
// docs/product/content-team-questionnaire.md). Once one exists, replace this
// function's body with:
//
//   var templateId = PropertiesService.getScriptProperties().getProperty("TEMPLATE_DOC_ID");
//   var copy = DriveApp.getFileById(templateId).makeCopy(titolo);
//   return DocumentApp.openById(copy.getId());
//
// Until then, this creates a bare Doc with a minimal outline from scratch —
// see tools/apps-script/README.md.
//
// DocumentApp.create() always lands in the creating writer's own My Drive
// root, which the pipeline's service account cannot read. The Doc is moved
// into the shared articles folder (ARTICLES_FOLDER_ID) so the service account
// inherits access through the folder share (CONTENT-CONTRACT.md §8).
function createArticleDoc(titolo, folderId) {
  // The file is named after the article (for finding it in Drive), but the
  // body never repeats the title: the site renders it from the Sheet.
  var doc = DocumentApp.create(titolo);
  var body = doc.getBody();
  buildArticleOutline().forEach(function (entry) {
    var paragraph = body.appendParagraph(entry[0]);
    if (entry[1]) {
      paragraph.setHeading(DocumentApp.ParagraphHeading[entry[1]]);
    }
  });
  doc.saveAndClose();
  DriveApp.getFileById(doc.getId()).moveTo(DriveApp.getFolderById(folderId));
  return doc;
}

// Starting outline for a new article Doc, as [text, DocumentApp heading
// key or null] pairs. No title line: `titolo` lives in the Sheet and the site
// renders it, so a title in the body was published twice
// (CONTENT-CONTRACT.md §6).
function buildArticleOutline() {
  return [
    ["Introduzione", "HEADING2"],
    ["", null],
    ["Sviluppo", "HEADING2"],
    ["", null],
    ["Conclusione", "HEADING2"],
    ["", null],
  ];
}

// Reads the shared articles folder ID from script properties
// (`props` is PropertiesService.getScriptProperties(), or a stub in tests).
function requireArticlesFolderId(props) {
  var value = props.getProperty("ARTICLES_FOLDER_ID");
  var folderId = value ? String(value).trim() : "";
  if (!folderId) {
    throw new Error(
      "Proprietà dello script mancante (ARTICLES_FOLDER_ID): serve l'ID della cartella " +
        "condivisa degli articoli. Vai su Estensioni > Apps Script > Impostazioni progetto > " +
        "Proprietà script."
    );
  }
  return folderId;
}

// Row shape matches COLUMN_ORDER (Columns.js) exactly. A new article starts
// as a draft: only titolo, doc and stato are known; everything else is left
// for the writer to fill in before setting stato to Pronto/Pubblicato.
function buildNewArticleRow(titolo, docUrl) {
  return [
    titolo, // titolo
    docUrl, // doc
    "", // categoria
    "", // tag
    "", // autore
    "", // ospite
    "", // spotify
    "", // copertina
    "", // meta_description
    "", // data
    "Bozza", // stato
    "", // esito
  ];
}

if (typeof module !== "undefined") {
  module.exports = { buildNewArticleRow, requireArticlesFolderId, buildArticleOutline };
}
