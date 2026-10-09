// Publish dates are stored as UTC instants: a Sheet `data` of 2026-10-06
// becomes Europe/Rome midnight, i.e. 2026-10-05T22:00:00Z
// (CONTENT-CONTRACT.md §3). The static build runs in UTC (Cloudflare Pages),
// so formatting without a timezone would show the previous day. Always
// format in Rome time -- the writers' and the readers' calendar.
export function formatPublishDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { timeZone: "Europe/Rome" });
}
