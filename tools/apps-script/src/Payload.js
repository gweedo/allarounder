// Builds the repository_dispatch payload exactly as specified in
// docs/architecture/CONTENT-CONTRACT.md §8. Kept pure (no SpreadsheetApp /
// UrlFetchApp calls) so it's testable under Jest without the Apps Script
// runtime.
function buildDispatchPayload(sheetId, triggeredBy, triggeredAtIso, row) {
  return {
    event_type: "publish_request",
    client_payload: {
      sheet_id: sheetId,
      triggered_by: triggeredBy,
      triggered_at: triggeredAtIso,
      row: row,
    },
  };
}

if (typeof module !== "undefined") {
  module.exports = { buildDispatchPayload };
}
