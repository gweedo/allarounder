import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

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

const BASE_ARTICLE = {
  id: "abc",
  title: "Titolo Articolo",
  slug: "titolo-articolo",
  body: "## Corpo",
  author_id: "user-1",
  publish_at: "2026-06-01T00:00:00Z",
  spotify_url: null as string | null,
  excerpt: null as string | null,
  cover_image_url: null as string | null,
  cover_image_alt: null as string | null,
  meta_title: null as string | null,
  meta_description: null as string | null,
  og_image_url: null as string | null,
  reading_time: null as number | null,
  author_profile: null as { id: string; name: string; slug: string } | null,
  category: null as { id: string; name: string; slug: string } | null,
  tags: [] as { id: string; name: string; slug: string }[],
};

beforeEach(() => {
  global.fetch = vi.fn();
});

async function renderArticlePage(article: typeof BASE_ARTICLE | null) {
  const ArticlePage = (await import("../page")).default;

  if (!article) {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });
  } else {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => article,
    });
  }

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

  it("does not render Spotify block when spotify_url is null", async () => {
    await renderArticlePage({ ...BASE_ARTICLE, spotify_url: null });
    expect(screen.queryByText(/ascolta su spotify/i)).toBeNull();
  });

  it("renders Spotify CTA when spotify_url is set", async () => {
    await renderArticlePage({
      ...BASE_ARTICLE,
      spotify_url: "https://open.spotify.com/episode/abc",
    });
    expect(screen.getByText(/ascolta su spotify/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ascolta su spotify/i })).toHaveAttribute(
      "href",
      "https://open.spotify.com/episode/abc"
    );
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

  it("calls notFound when article fetch fails", async () => {
    const result = await renderArticlePage(null);
    expect(result).toBe("notFound");
  });
});

describe("generateMetadata", () => {
  it("returns meta_title when set", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...BASE_ARTICLE, meta_title: "Titolo SEO Personalizzato" }),
    });
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "titolo-articolo" }) });
    expect(meta.title).toBe("Titolo SEO Personalizzato");
  });

  it("returns fallback title from article title when meta_title is null", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...BASE_ARTICLE, meta_title: null }),
    });
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "titolo-articolo" }) });
    expect(meta.title).toBe("Titolo Articolo — Allarounder");
  });

  it("populates openGraph images when og_image_url is set", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...BASE_ARTICLE,
        og_image_url: "https://cdn.allarounder.it/og/articolo.jpg",
      }),
    });
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "titolo-articolo" }) });
    const og = meta.openGraph as { images?: { url: string }[] };
    expect(og?.images).toEqual([{ url: "https://cdn.allarounder.it/og/articolo.jpg" }]);
  });

  it("returns empty object when article not found", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false });
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "missing" }) });
    expect(meta).toEqual({});
  });
});
