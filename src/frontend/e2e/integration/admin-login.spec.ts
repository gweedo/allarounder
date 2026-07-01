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

  test("logout clears session cookie and redirects to /admin/login", async ({ page }) => {
    // Log in first
    await page.goto("/admin/login");
    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", ADMIN_PASSWORD);
    await page.click("button[type=submit]");
    await page.waitForURL("**/admin", { timeout: 15_000 });

    // No logout button in the UI — call the API directly.
    // page.request shares the browser context's cookie jar.
    await page.request.post("/api/admin/auth/logout");

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
