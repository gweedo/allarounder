import { test, expect, type Page } from "@playwright/test";
import { AUTH_FILE } from "../test-data";

// Helper: create a published article with a category, authenticated as admin.
async function seedPublishedArticle(
  page: Page,
): Promise<{ title: string; slug: string; categorySlug: string }> {
  // Create category
  const catName = `PubCat ${Date.now()}`;
  const catRes = await page.request.post("/api/admin/categories", {
    data: { name: catName, description: null },
  });
  const catData = (await catRes.json()) as { id: string; slug: string };

  // Create article
  const title = `Public Article ${Date.now()}`;
  const artRes = await page.request.post("/api/admin/articles", {
    data: { title, body: "## Testo\n\nCorpo dell'articolo pubblico." },
  });
  const artData = (await artRes.json()) as { id: string };

  // Update article with category and excerpt
  await page.request.put(`/api/admin/articles/${artData.id}`, {
    data: {
      title,
      body: "## Testo\n\nCorpo dell'articolo pubblico.",
      excerpt: "Estratto dell'articolo pubblico.",
      category_id: catData.id,
      spotify_url: "https://open.spotify.com/episode/pub123",
      tags: [],
      guest_ids: [],
    },
  });

  // Publish
  await page.request.post(`/api/admin/articles/${artData.id}/publish`);

  // Get the slug
  const detailRes = await page.request.get(`/api/admin/articles/${artData.id}`);
  const detail = (await detailRes.json()) as { slug: string };

  return { title, slug: detail.slug, categorySlug: catData.slug };
}

test.describe("Public pages", () => {
  test.use({ storageState: AUTH_FILE });

  test("homepage shows published articles and renders h1", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // At least one article should be listed (seeded by the articles spec)
    await expect(page.locator("h2").first()).toBeVisible();
  });

  test("article detail renders body, Spotify link, and SEO title", async ({
    page,
  }) => {
    const { title, slug } = await seedPublishedArticle(page);

    await page.goto(`/articoli/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText(/Ascolta su Spotify/i)).toBeVisible();

    // Meta title should reference the article title
    const metaTitle = await page.title();
    expect(metaTitle).toContain(title);
  });

  test("category archive page lists published articles in that category", async ({
    page,
  }) => {
    const { title, categorySlug } = await seedPublishedArticle(page);

    await expect(async () => {
      await page.goto(`/argomenti/${categorySlug}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText(title)).toBeVisible();
    }).toPass({ timeout: 20_000, intervals: [2000, 3000] });
  });
});
