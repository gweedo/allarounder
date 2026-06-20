import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const BASE_TAG = {
  id: "tag-1",
  name: "calcio",
  slug: "calcio",
  articles: [] as {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    cover_image_url: string | null;
    cover_image_alt: string | null;
    reading_time: number | null;
    publish_at: string;
  }[],
  total: 0,
  page: 1,
  page_size: 20,
};

beforeEach(() => {
  global.fetch = vi.fn();
});

async function renderTagPage(data: typeof BASE_TAG | null) {
  const TagPage = (await import("../page")).default;

  if (!data) {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });
  } else {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => data,
    });
  }

  try {
    render(await TagPage({ params: Promise.resolve({ slug: data?.slug ?? "missing" }) }));
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_NOT_FOUND") return "notFound";
    throw e;
  }
  return "rendered";
}

describe("TagPage", () => {
  it("renders tag name as heading", async () => {
    await renderTagPage(BASE_TAG);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("#calcio");
  });

  it("renders article count", async () => {
    await renderTagPage({ ...BASE_TAG, total: 3 });
    expect(screen.getByText(/3 articoli/i)).toBeInTheDocument();
  });

  it("renders empty state when no articles", async () => {
    await renderTagPage(BASE_TAG);
    expect(screen.getByText(/nessun articolo/i)).toBeInTheDocument();
  });

  it("renders article list with links", async () => {
    await renderTagPage({
      ...BASE_TAG,
      total: 1,
      articles: [
        {
          id: "a1",
          title: "Articolo di test",
          slug: "articolo-di-test",
          excerpt: "Un estratto",
          cover_image_url: null,
          cover_image_alt: null,
          reading_time: 5,
          publish_at: "2026-06-01T00:00:00Z",
        },
      ],
    });
    const link = screen.getByRole("link", { name: "Articolo di test" });
    expect(link).toHaveAttribute("href", "/articoli/articolo-di-test");
    expect(screen.getByText("Un estratto")).toBeInTheDocument();
    expect(screen.getByText(/5 min/i)).toBeInTheDocument();
  });

  it("calls notFound when tag is not found", async () => {
    const result = await renderTagPage(null);
    expect(result).toBe("notFound");
  });
});
