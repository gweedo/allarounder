import { describe, it, expect, vi } from "vitest";

const content = vi.hoisted(() => ({
  articles: [{ slug: "a1", updated_at: "2026-10-01T00:00:00Z" }],
  categories: [
    { slug: "analisi", article_count: 1 },
    { slug: "roundtable", article_count: 0 },
  ],
  authors: [{ slug: "chiara", article_count: 1 }],
  guests: [] as { slug: string; article_count: number }[],
  tags: [{ slug: "nba", article_count: 1 }],
}));

vi.mock("../../lib/content", () => ({
  getArticleCards: () => ({ items: content.articles, total: content.articles.length, page: 1, page_size: 0 }),
  getCategoryIndex: () => content.categories,
  getAuthorIndex: () => content.authors,
  getGuestIndex: () => content.guests,
  getTagIndex: () => content.tags,
}));

const BASE = "https://allarounder.it";

async function urls(): Promise<string[]> {
  const { default: sitemap } = await import("../sitemap");
  return (await sitemap()).map((e) => e.url);
}

describe("sitemap", () => {
  it("lists the home page, static pages, articles and non-empty taxonomy pages", async () => {
    const list = await urls();
    for (const path of ["", "/chi-siamo", "/articoli/a1", "/argomenti/analisi", "/autori/chiara", "/tag/nba"]) {
      expect(list).toContain(`${BASE}${path}`);
    }
  });

  it("lists the section roots that have entries", async () => {
    const list = await urls();
    for (const path of ["/articoli", "/argomenti", "/autori", "/tag"]) {
      expect(list).toContain(`${BASE}${path}`);
    }
  });

  it("leaves out empty pages, which are noindex", async () => {
    const list = await urls();
    expect(list).not.toContain(`${BASE}/argomenti/roundtable`);
    expect(list).not.toContain(`${BASE}/ospiti`);
  });
});
