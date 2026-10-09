import { describe, it, expect } from "vitest";
import { formatPublishDate } from "../dates";

// The same calendar day formatted at midday UTC -- unambiguous in any
// timezone, so it pins the expected Italian date without hardcoding the
// locale's exact separators or padding.
const sameDay = (isoDay: string) =>
  new Date(`${isoDay}T12:00:00Z`).toLocaleDateString("it-IT", { timeZone: "UTC" });

describe("formatPublishDate", () => {
  it("shows the Italian calendar day for an Italian midnight (CEST)", () => {
    // `data` 2026-10-06 is published at Rome midnight = 22:00 UTC the day before.
    expect(formatPublishDate("2026-10-05T22:00:00Z")).toBe(sameDay("2026-10-06"));
  });

  it("shows the Italian calendar day for an Italian midnight (CET)", () => {
    expect(formatPublishDate("2026-01-14T23:00:00Z")).toBe(sameDay("2026-01-15"));
  });

  it("does not depend on the build machine's timezone", () => {
    // Late evening UTC is already the next day in Rome.
    expect(formatPublishDate("2026-06-30T23:30:00Z")).toBe(sameDay("2026-07-01"));
  });
});
