import { test, expect } from "@playwright/test";

test.describe("Section index pages", () => {
  for (const [path, heading] of [
    ["/articoli", "Articoli"],
    ["/argomenti", "Argomenti"],
    ["/autori", "Autori"],
    ["/ospiti", "Ospiti"],
    ["/tag", "Tag"],
  ]) {
    test(`${path} renders instead of 404`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    });
  }

  test("every fixed category has a page, even before its first article", async ({ page }) => {
    await page.goto("/argomenti");
    for (const name of ["Interviste", "Analisi", "Roundtable", "Out of the Box"]) {
      await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await page.getByRole("link", { name: "Roundtable", exact: true }).click();
    // `next dev` compiles routes on first visit; see homepage.spec.ts.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Roundtable", { timeout: 30_000 });
  });
});
