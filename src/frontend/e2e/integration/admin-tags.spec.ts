import { test, expect, type Page } from "@playwright/test";
import { AUTH_FILE } from "../test-data";

test.use({ storageState: AUTH_FILE });

async function createAndPublishArticle(page: Page): Promise<{ id: string; slug: string }> {
  await page.goto("/admin/articles/new");
  const title = `Tag Article ${Date.now()}`;
  await page.fill("#title", title);
  await page.fill("#body", "Articolo per il test dei tag.");

  const [createRes] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes("/api/admin/articles") && r.request().method() === "POST",
    ),
    page.click("button[type=submit]"),
  ]);
  const { id } = (await createRes.json()) as { id: string };

  await page.goto(`/admin/articles/${id}`);

  // Publish
  await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes(`/api/admin/articles/${id}/publish`) &&
        r.request().method() === "POST",
      { timeout: 10_000 },
    ),
    page.click("text=Pubblica"),
  ]);
  await expect(page.locator("strong").filter({ hasText: /published/i })).toBeVisible();

  // Get slug
  const apiRes = await page.request.get(`/api/admin/articles/${id}`);
  const data = (await apiRes.json()) as { slug: string };
  return { id, slug: data.slug };
}

test.describe("Admin tags", () => {
  test("add tag to article → tag appears on public article page", async ({ page }) => {
    const { id, slug } = await createAndPublishArticle(page);
    const tagName = `testtag${Date.now()}`;

    // Add tag on the edit page
    await page.goto(`/admin/articles/${id}`);
    await page.fill("#tag-input", tagName);
    await page.getByRole("button", { name: /aggiungi/i }).click();

    // Tag chip should appear
    await expect(page.getByText(`#${tagName}`)).toBeVisible({ timeout: 5_000 });

    // Save the article to persist the tag
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/admin/articles/${id}`) &&
          r.request().method() === "PUT",
        { timeout: 10_000 },
      ),
      page.click("button[type=submit]"),
    ]);
    await expect(page.getByRole("button", { name: "Salva" })).toBeEnabled();

    // Tag appears on public article detail page
    await page.goto(`/articoli/${slug}`);
    await expect(page.getByText(tagName)).toBeVisible({ timeout: 10_000 });
  });
});
