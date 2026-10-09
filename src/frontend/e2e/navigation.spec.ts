import { readFileSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";

const publishedArticles: { slug: string }[] = JSON.parse(
  readFileSync(path.join(__dirname, "..", "content", "index.json"), "utf-8"),
).articles;

test.describe("Site header", () => {
  test("a reader landing on an article can get back to the home page", async ({ page }) => {
    test.skip(publishedArticles.length === 0, "no article published yet");
    await page.goto(`/articoli/${publishedArticles[0].slug}`);

    await page.getByRole("banner").getByRole("link", { name: "Allarounder" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("the first Tab reaches a skip link that jumps to the main content", async ({ page }) => {
    await page.goto("/chi-siamo");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Vai al contenuto" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#contenuto$/);
    await expect(page.locator("main#contenuto")).toBeVisible();
  });
});
