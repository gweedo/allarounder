import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test("renders the site heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("hero article title is visible → click → arrive at article page", async ({ page }) => {
    await page.goto("/");
    const heroHeading = page.getByRole("region", { name: /articolo in evidenza/i }).getByRole("heading", { level: 2 });
    await expect(heroHeading).toBeVisible();

    await page.getByRole("link", { name: /leggi/i }).first().click();
    await expect(page).toHaveURL(/\/articoli\//);
  });
});
