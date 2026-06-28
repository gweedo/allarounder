import { test, expect, type Page } from "@playwright/test";
import { AUTH_FILE } from "../test-data";

test.use({ storageState: AUTH_FILE });

async function createArticle(
  page: Page,
  title: string,
  body: string,
): Promise<string> {
  await page.goto("/admin/articles/new");
  await page.fill("#title", title);
  await page.fill("#body", body);

  // Capture the POST response to get the article id before redirect.
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes("/api/admin/articles") && r.request().method() === "POST",
    ),
    page.click("button[type=submit]"),
  ]);

  const data = await response.json();
  return data.id as string;
}

test.describe("Admin articles CRUD", () => {
  test("create draft → edit → publish → appears on public pages", async ({
    page,
  }) => {
    const title = `Test Article ${Date.now()}`;
    const body = "## Intro\n\nThis is the **integration test** article body.";
    const excerpt = "A short excerpt for the article.";
    const spotifyUrl = "https://open.spotify.com/episode/test123";

    // 1. Create draft
    const id = await createArticle(page, title, body);
    await page.waitForURL("**/admin/articles");
    await expect(page.getByText(title)).toBeVisible();

    // 2. Navigate to edit page
    await page.goto(`/admin/articles/${id}`);

    // Verify draft status is shown
    await expect(page.locator("strong").filter({ hasText: /draft/i })).toBeVisible();

    // 3. Add excerpt and Spotify URL, then save (wait for the PUT response)
    await page.fill("#excerpt", excerpt);
    await page.fill("#spotify-url", spotifyUrl);

    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/admin/articles/${id}`) &&
          r.request().method() === "PUT",
        { timeout: 10_000 },
      ),
      page.click("button[type=submit]"),
    ]);

    // After save, the save button should be back to "Salva" (not "…")
    await expect(page.getByRole("button", { name: "Salva" })).toBeEnabled();

    // 4. Publish — button disappears after status changes to "published"
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/admin/articles/${id}/publish`) &&
          r.request().method() === "POST",
        { timeout: 10_000 },
      ),
      page.click("text=Pubblica"),
    ]);

    // Status shows "published"; the "Pubblica" button is hidden
    await expect(page.locator("strong").filter({ hasText: /published/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pubblica" })).toBeHidden();

    // 5. Get slug from the API
    const apiRes = await page.request.get(`/api/admin/articles/${id}`);
    const articleData = (await apiRes.json()) as { slug: string };
    const actualSlug = articleData.slug;

    // Public article detail page renders the title and Spotify link
    await page.goto(`/articoli/${actualSlug}`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText(/Ascolta su Spotify/i)).toBeVisible();

    // 6. Public homepage renders and shows article content.
    // The article list is SSR-cached (revalidate: 60), so we can't reliably
    // assert the just-published title appears immediately. Instead verify the
    // homepage renders its h1 and at least one article card (h2).
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("h2").first()).toBeVisible();
  });
});
