import { describe, it, expect, vi } from "vitest";

const ref = (slug: string, name = slug) => ({ id: `id-${slug}`, name, slug });

const INDEX = {
  articles: [
    {
      slug: "a1",
      publish_at: "2026-10-01T00:00:00Z",
      category: ref("analisi", "Analisi"),
      author_profile: ref("zeta", "Zeta"),
      tags: [ref("nba", "NBA"), ref("ansia")],
      guests: [ref("ospite", "Ospite")],
    },
    {
      slug: "a2",
      publish_at: "2026-10-02T00:00:00Z",
      category: ref("analisi", "Analisi"),
      author_profile: ref("alfa", "Alfa"),
      tags: [ref("nba", "NBA")],
      guests: [],
    },
  ],
  categories: [
    { ...ref("interviste", "Interviste"), description: null },
    { ...ref("analisi", "Analisi"), description: "Approfondimenti." },
  ],
  authors: [
    { ...ref("zeta", "Zeta"), bio: null, photo_url: null, links: {} },
    { ...ref("alfa", "Alfa"), bio: null, photo_url: null, links: {} },
  ],
  guests: [{ ...ref("ospite", "Ospite"), bio: null, photo_url: null, links: {} }],
  tags: [ref("nba", "NBA"), ref("ansia")],
};

// Markdown files keyed by their path under content/.
const FILES: Record<string, string> = {
  "articles/a1.md": "---\ntitle: Primo\nslug: a1\n---\n\n## Corpo\n",
  "pages/chi-siamo.md": "---\ntitle: Chi siamo\nslug: chi-siamo\n---\n\nTesto.\n",
};

function relative(file: string): string {
  return file.split(/[\\/]content[\\/]/).pop()!.replace(/\\/g, "/");
}

vi.mock("fs", () => ({
  default: {
    readFileSync: (file: string) =>
      file.endsWith("index.json") ? JSON.stringify(INDEX) : FILES[relative(file)],
    existsSync: (file: string) => relative(file) in FILES,
  },
}));

const content = await import("../content");

describe("article loaders", () => {
  it("returns cards newest first, paginated, with the total", () => {
    const page = content.getArticleCards(1, 1);
    expect(page.items.map((a) => a.slug)).toEqual(["a2"]);
    expect(page.total).toBe(2);
    expect(content.getArticleCards(2, 1).items.map((a) => a.slug)).toEqual(["a1"]);
  });

  it("lists every article slug", () => {
    expect(content.getAllArticleSlugs()).toEqual(["a1", "a2"]);
  });

  it("reads an article's frontmatter and trimmed Markdown body", () => {
    const article = content.getArticleBySlug("a1");
    expect(article?.title).toBe("Primo");
    expect(article?.body).toBe("## Corpo");
  });

  it("returns null for an unknown article", () => {
    expect(content.getArticleBySlug("missing")).toBeNull();
  });
});

describe("taxonomy loaders", () => {
  it("lists slugs for static params", () => {
    expect(content.getAllCategorySlugs()).toEqual(["interviste", "analisi"]);
    expect(content.getAllAuthorSlugs()).toEqual(["zeta", "alfa"]);
    expect(content.getAllGuestSlugs()).toEqual(["ospite"]);
    expect(content.getAllTagSlugs()).toEqual(["nba", "ansia"]);
  });

  it("resolves each taxonomy to its detail and articles", () => {
    expect(content.getCategoryBySlug("analisi")?.articles.map((a) => a.slug)).toEqual(["a2", "a1"]);
    expect(content.getAuthorBySlug("alfa")?.articles.map((a) => a.slug)).toEqual(["a2"]);
    expect(content.getGuestBySlug("ospite")?.articles.map((a) => a.slug)).toEqual(["a1"]);
    expect(content.getTagBySlug("ansia")?.articles.map((a) => a.slug)).toEqual(["a1"]);
  });

  it("returns null for unknown taxonomy slugs", () => {
    expect(content.getCategoryBySlug("x")).toBeNull();
    expect(content.getAuthorBySlug("x")).toBeNull();
    expect(content.getGuestBySlug("x")).toBeNull();
    expect(content.getTagBySlug("x")).toBeNull();
  });
});

describe("static page loader", () => {
  it("reads a page's frontmatter and body", () => {
    const page = content.getStaticPageBySlug("chi-siamo");
    expect(page?.title).toBe("Chi siamo");
    expect(page?.body).toBe("Testo.");
  });

  it("returns null for an unknown page", () => {
    expect(content.getStaticPageBySlug("missing")).toBeNull();
  });
});

describe("section index loaders", () => {
  it("lists categories in index order with their article counts, empty ones included", () => {
    expect(content.getCategoryIndex().map((c) => [c.slug, c.article_count])).toEqual([
      ["interviste", 0],
      ["analisi", 2],
    ]);
    expect(content.getCategoryIndex()[1].description).toBe("Approfondimenti.");
  });

  it("lists authors alphabetically with their article counts", () => {
    expect(content.getAuthorIndex().map((a) => [a.slug, a.article_count])).toEqual([
      ["alfa", 1],
      ["zeta", 1],
    ]);
  });

  it("lists guests with their article counts", () => {
    expect(content.getGuestIndex().map((g) => [g.slug, g.article_count])).toEqual([["ospite", 1]]);
  });

  it("lists tags alphabetically, ignoring case, with their article counts", () => {
    expect(content.getTagIndex().map((t) => [t.name, t.article_count])).toEqual([
      ["ansia", 1],
      ["NBA", 2],
    ]);
  });
});
