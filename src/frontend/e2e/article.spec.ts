import { readFileSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";

const publishedArticles: { slug: string }[] = JSON.parse(
  readFileSync(path.join(__dirname, "..", "content", "index.json"), "utf-8"),
).articles;

test.describe("Article page", () => {
  test("a reader can continue to another article from the end of the page", async ({ page }) => {
    test.skip(publishedArticles.length < 2, "needs two published articles");
    await page.goto(`/articoli/${publishedArticles[0].slug}`);

    const next = page.getByRole("region", { name: "Leggi anche" }).getByRole("link").first();
    const href = await next.getAttribute("href");
    expect(href).toMatch(/^\/articoli\//);
    expect(href).not.toBe(`/articoli/${publishedArticles[0].slug}`);

    await next.click();
    // `next dev` compiles routes on first visit; see homepage.spec.ts.
    await expect(page).toHaveURL(new RegExp(`${href}$`), { timeout: 30_000 });
  });

  test("the page does not scroll sideways on a phone", async ({ page }) => {
    test.skip(publishedArticles.length === 0, "no article published yet");
    await page.setViewportSize({ width: 390, height: 844 });
    for (const { slug } of publishedArticles) {
      await page.goto(`/articoli/${slug}`);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, slug).toBeLessThanOrEqual(0);
    }
  });
});
