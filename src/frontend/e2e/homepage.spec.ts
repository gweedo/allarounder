import { readFileSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";

// The site renders whatever the pipeline has published; before the first
// real article there is no hero to click through to.
const publishedArticles: unknown[] = JSON.parse(
  readFileSync(path.join(__dirname, "..", "content", "index.json"), "utf-8"),
).articles;

test.describe("Homepage", () => {
  test("renders the site heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("hero article title is visible → click → arrive at article page", async ({ page }) => {
    test.skip(publishedArticles.length === 0, "no article published yet");
    await page.goto("/");
    const heroHeading = page.getByRole("region", { name: /articolo in evidenza/i }).getByRole("heading", { level: 2 });
    await expect(heroHeading).toBeVisible();

    await page.getByRole("link", { name: /leggi/i }).first().click();
    // `next dev` compiles the article route on first visit, which can take
    // longer than the default 5s expect timeout on a cold server.
    await expect(page).toHaveURL(/\/articoli\//, { timeout: 30_000 });
  });
});
