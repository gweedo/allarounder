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

  it("calls notFound when article fetch fails", async () => {
    const result = await renderArticlePage(null);
    expect(result).toBe("notFound");
  });
});
