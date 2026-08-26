import { test, expect } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../test-data";

/**
 * Regression test for the middleware silent-refresh flow (see middleware.ts).
 *
 * Before this change, the admin middleware only ever checked the short-lived
 * access_token cookie: once it expired (or was cleared) mid-session, the next
 * navigation bounced the writer to /admin/login even though a valid
 * refresh_token cookie was still sitting in the jar. The middleware now
 * exchanges the refresh token for a fresh access token server-side before
 * redirecting.
 *
 * Requires Docker (backend + frontend running via docker compose) — see
 * playwright.integration.config.ts. Not runnable in this container; verified
 * in CI.
 */
test.describe("Admin session persistence", () => {
  test("losing the access_token cookie mid-session does not bounce to login", async ({
    page,
    context,
  }) => {
    await page.goto("/admin/login");
    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", ADMIN_PASSWORD);
    await page.click("button[type=submit]");
    await page.waitForURL("**/admin", { timeout: 15_000 });

    // Simulate the access token expiring: drop only that cookie, keep the
    // refresh token (14-day cookie, since "Ricordami" defaults to checked).
    await context.clearCookies({ name: "access_token" });

    await page.goto("/admin/articles");

    // The middleware should have silently refreshed and let the request
    // through, rather than redirecting to /admin/login.
    await expect(page).toHaveURL(/\/admin\/articles$/);
    await expect(page.getByRole("heading", { name: /articoli/i })).toBeVisible();

    // A fresh access_token cookie should have been issued by the refresh.
    const cookies = await context.cookies();
    const accessCookie = cookies.find((c) => c.name === "access_token");
    expect(accessCookie).toBeDefined();
  });
});
