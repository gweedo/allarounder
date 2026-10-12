import { readFileSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";

const publishedArticles: { slug: string }[] = JSON.parse(
  readFileSync(path.join(__dirname, "..", "content", "index.json"), "utf-8"),
).articles;

// next/font names each family after the const in app/layout.tsx, plus a hash.
// Its metric-adjusted fallbacks ("… Fallback") load from local system fonts,
// so they're excluded: only the self-hosted faces count.
const FAMILIES = [/barlowCondensed/i, /literata/i, /plexMono/i];

// The brand faces are self-hosted (ADR-0019): every font comes from the
// site's own origin, and each family actually renders on the page.
test.describe("Brand fonts", () => {
  const pages = ["/", ...publishedArticles.slice(0, 1).map(({ slug }) => `/articoli/${slug}`)];

  for (const pagePath of pages) {
    test(`load from the site itself on ${pagePath}`, async ({ page, baseURL }) => {
      const requests: string[] = [];
      page.on("request", (request) => requests.push(request.url()));

      await page.goto(pagePath);
      const loaded = await page.evaluate(async () => {
        await document.fonts.ready;
        return [...document.fonts]
          .filter((f) => f.status === "loaded" && !/fallback/i.test(f.family))
          .map((f) => f.family);
      });

      for (const family of FAMILIES) {
        expect(
          loaded.some((name) => family.test(name)),
          `${family} in ${loaded}`,
        ).toBe(true);
      }

      const origin = new URL(baseURL!).origin;
      expect(requests.filter((url) => /fonts\.(googleapis|gstatic)\.com/.test(url))).toEqual([]);
      const fonts = requests.filter((url) => new URL(url).pathname.endsWith(".woff2"));
      expect(fonts.length).toBeGreaterThan(0);
      for (const url of fonts) expect(new URL(url).origin).toBe(origin);
    });
  }
});
