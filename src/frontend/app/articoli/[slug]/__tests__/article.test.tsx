import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Article, ArticleMeta } from "../../../../lib/content";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("remark", () => ({
  remark: () => ({
    use: () => ({
      use: () => ({
        use: () => ({
          process: vi.fn().mockResolvedValue({ toString: () => "<p>corpo</p>" }),
        }),
      }),
    }),
  }),
}));

vi.mock("remark-rehype", () => ({ default: vi.fn() }));
vi.mock("rehype-sanitize", () => ({ default: vi.fn() }));
vi.mock("rehype-stringify", () => ({ default: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const getArticleBySlug = vi.fn();
const getRelatedArticles = vi.fn((..._args: unknown[]): ArticleMeta[] => []);
vi.mock("../../../../lib/content", () => ({
  getArticleBySlug: (slug: string) => getArticleBySlug(slug),
  getAllArticleSlugs: () => [],
  getRelatedArticles: (...args: unknown[]) => getRelatedArticles(...args),
}));

const site = vi.hoisted(() => ({ SPOTIFY_SHOW_URL: null as string | null }));
vi.mock("../../../../lib/site", () => site);

beforeEach(() => {
  site.SPOTIFY_SHOW_URL = null;
  getRelatedArticles.mockReset();
  getRelatedArticles.mockReturnValue([]);
});

const BASE_ARTICLE: Article = {
  id: "abc",
  title: "Titolo Articolo",
  slug: "titolo-articolo",
  body: "## Corpo",
  author_id: "user-1",
  publish_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
  spotify_url: null,
  excerpt: null,
  cover_image_url: null,
  cover_image_alt: null,
  meta_title: null,
  meta_description: null,
  og_image_url: null,
  reading_time: null,
  author_profile: null,
  category: null,
  tags: [],
  guests: [],
};

async function renderArticlePage(article: Article | null) {
  const ArticlePage = (await import("../page")).default;
  getArticleBySlug.mockReturnValueOnce(article);

  try {
    render(await ArticlePage({ params: Promise.resolve({ slug: article?.slug ?? "missing" }) }));
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_NOT_FOUND") {
      return "notFound";
    }
    throw e;
  }
  return "rendered";
}

describe("ArticlePage", () => {
  it("renders the article title", async () => {
    await renderArticlePage(BASE_ARTICLE);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Titolo Articolo");
  });

  it("renders article body HTML", async () => {
    await renderArticlePage(BASE_ARTICLE);
    expect(document.querySelector(".article-body")).toBeTruthy();
  });

  it("does not render a Spotify block when neither the episode nor the show URL is set", async () => {
    await renderArticlePage({ ...BASE_ARTICLE, spotify_url: null });
    expect(screen.queryByRole("link", { name: /spotify/i })).toBeNull();
  });

  it("links to the episode on Spotify when spotify_url is set", async () => {
    site.SPOTIFY_SHOW_URL = "https://open.spotify.com/show/xyz";
    await renderArticlePage({
      ...BASE_ARTICLE,
      spotify_url: "https://open.spotify.com/episode/abc",
    });
    const link = screen.getByRole("link", { name: /ascolta l'episodio su spotify/i });
    expect(link).toHaveAttribute("href", "https://open.spotify.com/episode/abc");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByRole("link", { name: /ascolta il podcast/i })).toBeNull();
  });

  it("falls back to the podcast show when the article has no episode link", async () => {
    site.SPOTIFY_SHOW_URL = "https://open.spotify.com/show/xyz";
    await renderArticlePage({ ...BASE_ARTICLE, spotify_url: null });
    expect(screen.getByRole("link", { name: /ascolta il podcast su spotify/i })).toHaveAttribute(
      "href",
      "https://open.spotify.com/show/xyz",
    );
  });

  it("suggests related articles under 'Leggi anche'", async () => {
    getRelatedArticles.mockReturnValue([
      { ...BASE_ARTICLE, id: "r1", slug: "altro-articolo", title: "Altro articolo" },
    ]);
    await renderArticlePage(BASE_ARTICLE);
    expect(getRelatedArticles).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "titolo-articolo" }),
      3,
    );
    const section = screen.getByRole("region", { name: "Leggi anche" });
    expect(within(section).getByRole("link", { name: "Altro articolo" })).toHaveAttribute(
      "href",
      "/articoli/altro-articolo",
    );
  });

  it("omits 'Leggi anche' when there is nothing else to read", async () => {
    await renderArticlePage(BASE_ARTICLE);
    expect(screen.queryByRole("region", { name: "Leggi anche" })).toBeNull();
  });

  it("links to more articles in the same category after the body", async () => {
    await renderArticlePage({
      ...BASE_ARTICLE,
      category: { id: "c1", name: "Analisi", slug: "analisi" },
    });
    expect(screen.getByRole("link", { name: /altri articoli in analisi/i })).toHaveAttribute(
      "href",
      "/argomenti/analisi",
    );
  });

  it("renders a breadcrumb trail Home › category › article", async () => {
    await renderArticlePage({
      ...BASE_ARTICLE,
      category: { id: "c1", name: "Analisi", slug: "analisi" },
    });
    const trail = screen.getByRole("navigation", { name: "Percorso" });
    const items = within(trail).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["Home", "Analisi", "Titolo Articolo"]);
    expect(within(trail).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(within(trail).getByRole("link", { name: "Analisi" })).toHaveAttribute("href", "/argomenti/analisi");
    expect(within(trail).getByText("Titolo Articolo")).toHaveAttribute("aria-current", "page");
  });

  it("emits BreadcrumbList structured data", async () => {
    await renderArticlePage({
      ...BASE_ARTICLE,
      category: { id: "c1", name: "Analisi", slug: "analisi" },
    });
    const blocks = [...document.querySelectorAll('script[type="application/ld+json"]')].map(
      (el) => JSON.parse(el.textContent ?? "{}"),
    );
    const crumbs = blocks.find((b) => b["@type"] === "BreadcrumbList");
    expect(crumbs.itemListElement.map((i: { name: string; item?: string }) => [i.name, i.item])).toEqual([
      ["Home", "https://allarounder.it"],
      ["Analisi", "https://allarounder.it/argomenti/analisi"],
      ["Titolo Articolo", undefined],
    ]);
  });

  it("renders cover image when cover_image_url is set", async () => {
    await renderArticlePage({
      ...BASE_ARTICLE,
      cover_image_url: "https://cdn.allarounder.it/images/copertina.jpg",
      cover_image_alt: "Copertina episodio sport",
    });
    const img = document.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toContain(encodeURIComponent("https://cdn.allarounder.it/images/copertina.jpg"));
    expect(img?.getAttribute("alt")).toBe("Copertina episodio sport");
  });

  it("renders author name linking to /autori/{slug}", async () => {
    await renderArticlePage({
      ...BASE_ARTICLE,
      author_profile: { id: "a1", name: "Marco Rossi", slug: "marco-rossi" },
    });
    const link = screen.getByRole("link", { name: "Marco Rossi" });
    expect(link).toHaveAttribute("href", "/autori/marco-rossi");
  });

  it("renders category link when category is present", async () => {
    await renderArticlePage({
      ...BASE_ARTICLE,
      category: { id: "cat-1", name: "Interviste", slug: "interviste" },
    });
    const link = screen.getByRole("link", { name: "Interviste" });
    expect(link).toHaveAttribute("href", "/argomenti/interviste");
  });

  it("renders tag chips linking to /tag/{slug}", async () => {
    await renderArticlePage({
      ...BASE_ARTICLE,
      tags: [
        { id: "t1", name: "calcio", slug: "calcio" },
        { id: "t2", name: "serie-a", slug: "serie-a" },
      ],
    });
    const calcioLink = screen.getByRole("link", { name: /#calcio/i });
    expect(calcioLink).toHaveAttribute("href", "/tag/calcio");
    const serieaLink = screen.getByRole("link", { name: /#serie-a/i });
    expect(serieaLink).toHaveAttribute("href", "/tag/serie-a");
  });

  it("does not render tags section when tags list is empty", async () => {
    await renderArticlePage({ ...BASE_ARTICLE, tags: [] });
    expect(screen.queryByText(/#/i)).toBeNull();
  });

  it("calls notFound when article lookup fails", async () => {
    const result = await renderArticlePage(null);
    expect(result).toBe("notFound");
  });
});

describe("generateMetadata", () => {
  it("returns meta_title when set", async () => {
    getArticleBySlug.mockReturnValueOnce({ ...BASE_ARTICLE, meta_title: "Titolo SEO Personalizzato" });
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "titolo-articolo" }) });
    expect(meta.title).toEqual({ absolute: "Titolo SEO Personalizzato" });
  });

  it("returns fallback title from article title when meta_title is null", async () => {
    getArticleBySlug.mockReturnValueOnce({ ...BASE_ARTICLE, meta_title: null });
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "titolo-articolo" }) });
    expect(meta.title).toEqual({ absolute: "Titolo Articolo — Allarounder" });
  });

  it("populates openGraph images when og_image_url is set", async () => {
    getArticleBySlug.mockReturnValueOnce({
      ...BASE_ARTICLE,
      og_image_url: "https://cdn.allarounder.it/og/articolo.jpg",
    });
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "titolo-articolo" }) });
    const og = meta.openGraph as { images?: { url: string }[] };
    expect(og?.images).toEqual([{ url: "https://cdn.allarounder.it/og/articolo.jpg" }]);
  });

  it("returns empty object when article not found", async () => {
    getArticleBySlug.mockReturnValueOnce(null);
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "missing" }) });
    expect(meta).toEqual({});
  });
});
