import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test("renders the site heading", async ({ page }) => {
    await page.route("**/api/articles*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], total: 0, page: 1, page_size: 13 }),
      }),
    );
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("hero article title is visible → click → arrive at article page", async ({ page }) => {
    const article = {
      id: "art-1",
      title: "Campionati del Mondo 2026",
      slug: "campionati-del-mondo-2026",
      excerpt: "Un grande evento.",
      cover_image_url: null,
      cover_image_alt: null,
      publish_at: "2026-06-01T00:00:00Z",
      updated_at: "2026-06-01T00:00:00Z",
      reading_time: 3,
      category: null,
      author_profile: null,
    };

    await page.route("**/api/articles*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [article], total: 1, page: 1, page_size: 13 }),
      }),
    );

    // Stub the article detail page so navigation doesn't 500
    await page.route("**/api/articles/campionati-del-mondo-2026", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...article, body: "Testo dell'articolo.", tags: [], guests: [] }),
      }),
    );

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Campionati del Mondo 2026" }),
    ).toBeVisible();

    await page.getByRole("link", { name: /leggi/i }).first().click();
    await expect(page).toHaveURL(/\/articoli\/campionati-del-mondo-2026/);
  });
});
