// "Pubblica" menu action. This file calls SpreadsheetApp / PropertiesService /
// UrlFetchApp directly, so it is not unit-testable outside the Apps Script
// runtime — the pure payload-building logic it depends on lives in
// Payload.js and Columns.js instead, and is covered by test/.

function handlePubblica() {
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSheet();
  var row = sheet.getActiveCell().getRow();

  if (row === 1) {
    ui.alert("Seleziona una riga di articolo, non l'intestazione.");
    return;
  }

  var sheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  var triggeredBy = Session.getActiveUser().getEmail();
  var triggeredAt = new Date().toISOString();
  var payload = buildDispatchPayload(sheetId, triggeredBy, triggeredAt, row);

  // Fire the dispatch *before* touching `stato` -- if it fails, the row must
  // be left exactly as it was. Setting `stato = Pubblicato` first and rolling
  // back on failure would leave a window where a nightly cron run (which
  // re-evaluates every Pubblicato row regardless of how it got that way,
  // CONTENT-CONTRACT.md §3) could publish the row anyway, silently
  // contradicting the failure the writer was just shown.
  try {
    triggerRepositoryDispatch(payload);
  } catch (err) {
    ui.alert("Pubblicazione non avviata: " + err.message);
    return;
  }

  // Only reachable once the dispatch has actually been accepted
  // (CONTENT-CONTRACT.md §1: "a writer never has to set the dropdown and
  // click a separate button" -- this is the one action that does both).
  sheet.getRange(row, getColumnIndex("stato")).setValue("Pubblicato");
  SpreadsheetApp.flush();

  ui.alert(
    "Pubblicazione avviata. Il sito si aggiornerà tra circa 2 minuti: " +
      "controlla la colonna \"esito\" tra poco per il risultato."
  );
}

// Fires GitHub's repository_dispatch API. Requires three script properties
// (Project Settings > Script Properties in the Apps Script editor) — see
// tools/apps-script/README.md for setup.
function triggerRepositoryDispatch(payload) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty("GITHUB_TOKEN");
  var owner = props.getProperty("GITHUB_OWNER");
  var repo = props.getProperty("GITHUB_REPO");

  if (!token || !owner || !repo) {
    throw new Error(
      "Proprietà dello script mancanti (GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO). " +
        "Vai su Estensioni > Apps Script > Impostazioni progetto > Proprietà script."
    );
  }

  var url = "https://api.github.com/repos/" + owner + "/" + repo + "/dispatches";
  var response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  // GitHub returns 204 No Content on a successful dispatch.
  if (response.getResponseCode() !== 204) {
    throw new Error(
      "GitHub ha rifiutato la richiesta (HTTP " +
        response.getResponseCode() +
        "): " +
        response.getContentText()
    );
  }
}
