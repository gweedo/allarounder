import { test, expect } from "@playwright/test";
import { AUTH_FILE } from "../test-data";

test.use({ storageState: AUTH_FILE });

test.describe("Admin authors", () => {
  test("create author → appears in list → author profile page renders", async ({
    page,
  }) => {
    const name = `Autore ${Date.now()}`;
    const bio = "Bio di un autore di test per l'integrazione.";

    await page.goto("/admin/authors");
    await page.waitForLoadState("networkidle");

    // Create
    await page.fill("#author-name", name);
    await page.fill("#author-bio", bio);
    await page.getByRole("button", { name: /crea autore/i }).click();

    // Verify it appears in the list
    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });

    // Find the author slug from the edit link rendered on the list page
    const editLink = page.locator("a").filter({ hasText: /modifica/i }).last();
    const href = await editLink.getAttribute("href");
    // href is /admin/authors/{id}; get the author slug from the public API
    const idMatch = href?.match(/\/admin\/authors\/([^/?]+)/);
    if (!idMatch) throw new Error(`No author ID found in href: ${href}`);
    const authorId = idMatch[1];

    // Fetch slug from admin API
    const apiRes = await page.request.get(`/api/admin/authors/${authorId}`);
    const authorData = (await apiRes.json()) as { slug: string };
    const slug = authorData.slug;

    // Public author profile page
    await page.goto(`/autori/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  });
});
