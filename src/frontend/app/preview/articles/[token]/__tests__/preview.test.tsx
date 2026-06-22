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
  title: "Bozza Articolo",
  slug: "bozza-articolo",
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
};

const TOKEN = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

beforeEach(() => {
  global.fetch = vi.fn();
});

async function renderPreviewPage(article: typeof BASE_ARTICLE | null) {
  const PreviewPage = (await import("../page")).default;

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
    render(await PreviewPage({ params: Promise.resolve({ token: TOKEN }) }));
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_NOT_FOUND") {
      return "notFound";
    }
    throw e;
  }
  return "rendered";
}

describe("PreviewArticlePage", () => {
  it("shows preview banner", async () => {
    await renderPreviewPage(BASE_ARTICLE);
    expect(screen.getByRole("banner", { name: /anteprima/i })).toBeInTheDocument();
    expect(screen.getByText(/ANTEPRIMA — non pubblicato/)).toBeInTheDocument();
  });

  it("renders the article title", async () => {
    await renderPreviewPage(BASE_ARTICLE);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Bozza Articolo");
  });

  it("renders article body HTML", async () => {
    await renderPreviewPage(BASE_ARTICLE);
    expect(document.querySelector(".article-body")).toBeTruthy();
  });

  it("renders Spotify CTA when spotify_url is set", async () => {
    await renderPreviewPage({
      ...BASE_ARTICLE,
      spotify_url: "https://open.spotify.com/episode/abc",
    });
    expect(screen.getByText(/ascolta su spotify/i)).toBeInTheDocument();
  });

  it("renders cover image when provided", async () => {
    await renderPreviewPage({
      ...BASE_ARTICLE,
      cover_image_url: "https://cdn.allarounder.it/img/cover.jpg",
      cover_image_alt: "Alt testo",
    });
    const img = document.querySelector("img");
    expect(img?.getAttribute("src")).toContain(encodeURIComponent("https://cdn.allarounder.it/img/cover.jpg"));
    expect(img?.getAttribute("alt")).toBe("Alt testo");
  });

  it("calls notFound when token is not found", async () => {
    const result = await renderPreviewPage(null);
    expect(result).toBe("notFound");
  });
});
