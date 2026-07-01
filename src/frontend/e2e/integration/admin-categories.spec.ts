import { test, expect } from "@playwright/test";
import { AUTH_FILE } from "../test-data";

test.use({ storageState: AUTH_FILE });

test.describe("Admin categories", () => {
  test("create category → appears in list → delete → gone", async ({ page }) => {
    const name = `Categoria ${Date.now()}`;
    const desc = "Categoria di test per l'integrazione.";

    await page.goto("/admin/categories");
    await page.waitForLoadState("networkidle");

    // Create
    await page.fill("#cat-name", name);
    await page.fill("#cat-desc", desc);
    await page.getByRole("button", { name: /crea categoria/i }).click();

    // Verify it appears in the list
    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });

    // Delete — the page calls window.confirm() before the DELETE request.
    // Override it to return true so the delete proceeds without a native dialog.
    await page.evaluate(() => { window.confirm = () => true; });
    const row = page.locator("li").filter({ hasText: name });
    await row.getByRole("button", { name: /elimina/i }).click();

    // Category should be gone
    await expect(page.getByText(name)).toBeHidden({ timeout: 10_000 });
  });
});
