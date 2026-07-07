import { test, expect } from "@playwright/test";
import { AUTH_FILE } from "../test-data";

test.use({ storageState: AUTH_FILE });

test.describe("Admin guests", () => {
  test("edit guest → changes persist round-trip", async ({ page }) => {
    const name = `Ospite Edit ${Date.now()}`;
    const updatedBio = "Bio aggiornata durante il test di integrazione.";

    // Create via the dedicated new-guest page
    await page.goto("/admin/guests/new");
    await page.fill("#guest-name", name);
    await page.getByRole("button", { name: /crea ospite/i }).click();
    await page.waitForURL("**/admin/guests");
    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });

    // Follow the "Modifica" link for the newly created guest
    const row = page.locator("li").filter({ hasText: name });
    await row.getByRole("link", { name: /modifica/i }).click();
    await page.waitForURL(/\/admin\/guests\/[^/]+$/);

    await expect(page.getByLabel(/nome \*/i)).toHaveValue(name);
    await page.fill("#guest-bio", updatedBio);

    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/api/admin/guests/") && r.request().method() === "PUT",
        { timeout: 10_000 },
      ),
      page.getByRole("button", { name: /salva/i }).click(),
    ]);

    // Redirects back to the list
    await page.waitForURL("**/admin/guests");
    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });

    // Re-open the edit page and verify the bio persisted
    await page.locator("li").filter({ hasText: name }).getByRole("link", { name: /modifica/i }).click();
    await expect(page.getByLabel(/^bio$/i)).toHaveValue(updatedBio);
  });
});
