import { describe, it, expect } from "vitest";
import { readingMinutes } from "../reading-time";

describe("readingMinutes", () => {
  it("returns the minutes when the reading time is positive", () => {
    expect(readingMinutes({ reading_time: 7 })).toBe(7);
  });

  it.each([null, 0])("returns null for a reading time of %s", (reading_time) => {
    expect(readingMinutes({ reading_time })).toBeNull();
  });
});
