import { test, expect } from "@playwright/test";

// The brand faces are self-hosted (ADR-0019): every font comes from the
// site's own origin, and each family actually renders on the page.
const PAGES = ["/", "/articoli/appunti-di-agonismo"];

// next/font names each family after the const in app/layout.tsx, plus a hash.
const FAMILIES = [/barlowCondensed/i, /literata/i, /plexMono/i];

for (const path of PAGES) {
  test(`brand fonts load from the site itself on ${path}`, async ({ page, baseURL }) => {
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));

    await page.goto(path);
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family);
    });

    for (const family of FAMILIES) {
      expect(loaded.some((name) => family.test(name)), `${family} in ${loaded}`).toBe(true);
    }

    const origin = new URL(baseURL!).origin;
    expect(requests.filter((url) => /fonts\.(googleapis|gstatic)\.com/.test(url))).toEqual([]);
    const fonts = requests.filter((url) => new URL(url).pathname.endsWith(".woff2"));
    expect(fonts.length).toBeGreaterThan(0);
    for (const url of fonts) expect(new URL(url).origin).toBe(origin);
  });
}
