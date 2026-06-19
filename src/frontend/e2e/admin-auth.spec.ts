import { test, expect } from "@playwright/test";

test.describe("Admin middleware redirect", () => {
  test("unauthenticated request to /admin is redirected to /admin/login", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("unauthenticated request to /admin/anything is redirected to /admin/login", async ({
    page,
  }) => {
    await page.goto("/admin/articles");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("/admin/login itself is accessible without a token", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("heading", { name: /accedi/i })).toBeVisible();
  });

  test("login page renders email and password fields", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /accedi/i })).toBeVisible();
  });
});
