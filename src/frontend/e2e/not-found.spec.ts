import { test, expect } from "@playwright/test";

test.describe("Not-found page", () => {
  test("an unknown URL shows the Italian 404 with a way back home", async ({ page }) => {
    // Three segments match no route. A one-segment URL would hit /[slug], and
    // `next dev` answers 500 under output: "export" for params missing from
    // generateStaticParams; the exported site serves 404.html for both.
    const response = await page.goto("/pagina/che/non-esiste");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pagina non trovata");
    await expect(page).toHaveTitle("Pagina non trovata — Allarounder");

    await page.getByRole("link", { name: /torna alla home/i }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
