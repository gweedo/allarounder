import { test, expect } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../test-data";

test.describe("Admin login", () => {
  test("login form renders without auth", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /accedi/i })).toBeVisible();
  });

  test("wrong credentials show error alert", async ({ page }) => {
    await page.goto("/admin/login");
    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", "wrongpassword123");
    await page.click("button[type=submit]");
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("correct credentials redirect to /admin dashboard", async ({ page }) => {
    await page.goto("/admin/login");
    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", ADMIN_PASSWORD);
    await page.click("button[type=submit]");
    await page.waitForURL("**/admin", { timeout: 15_000 });
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("logged-in sidebar shows all 7 nav sections", async ({ page }) => {
    await page.goto("/admin/login");
    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", ADMIN_PASSWORD);
    await page.click("button[type=submit]");
    await page.waitForURL("**/admin", { timeout: 15_000 });

    const nav = page.getByRole("navigation", { name: /amministrazione/i });
    await expect(nav).toBeVisible();
    for (const label of [
      "Bacheca",
      "Articoli",
      "Autori",
      "Ospiti",
      "Categorie",
      "Tag",
      "Pagine",
    ]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }
  });

  test("Esci logs out and redirects to /admin/login; protected pages then bounce back", async ({
    page,
  }) => {
    // Log in first
    await page.goto("/admin/login");
    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", ADMIN_PASSWORD);
    await page.click("button[type=submit]");
    await page.waitForURL("**/admin", { timeout: 15_000 });

    await page.getByRole("button", { name: /esci/i }).click();
    await page.waitForURL("**/admin/login", { timeout: 15_000 });
    await expect(page).toHaveURL(/\/admin\/login$/);

    // Session is gone — a protected page should redirect back to login.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
