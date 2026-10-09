import { describe, it, expect } from "vitest";
import robots from "../robots";

describe("robots", () => {
  it("allows the whole site and blocks nothing", () => {
    // The static site has no /admin, /preview or /api -- those were routes of
    // the retired FastAPI/Next.js-server stack (ADR-0018).
    expect(robots().rules).toEqual([{ userAgent: "*", allow: "/" }]);
  });

  it("points crawlers at the canonical sitemap", () => {
    expect(robots().sitemap).toBe("https://allarounder.it/sitemap.xml");
  });
});
