import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const BASE_CATEGORY = {
  id: "cat-1",
  name: "Interviste",
  slug: "interviste",
  description: "Conversazioni con esperti.",
  articles: [] as Array<{
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    cover_image_url: string | null;
    cover_image_alt: string | null;
    reading_time: number | null;
    publish_at: string;
  }>,
  total: 0,
  page: 1,
  page_size: 20,
};

const SAMPLE_ARTICLE = {
  id: "art-1",
  title: "Intervista a Mario Rossi",
  slug: "intervista-mario-rossi",
  excerpt: "Un'intervista incredibile.",
  cover_image_url: null,
  cover_image_alt: null,
  reading_time: 5,
  publish_at: "2026-06-01T00:00:00Z",
};

beforeEach(() => {
  global.fetch = vi.fn();
});

async function renderCategoryPage(data: typeof BASE_CATEGORY | null) {
  const CategoryPage = (await import("../page")).default;
  if (!data) {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
    });
  } else {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => data,
    });
  }
  try {
    render(await CategoryPage({ params: Promise.resolve({ slug: data?.slug ?? "missing" }) }));
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_NOT_FOUND") return "notFound";
    throw e;
  }
  return "rendered";
}

describe("CategoryPage", () => {
  it("renders category name as heading", async () => {
    await renderCategoryPage(BASE_CATEGORY);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Interviste");
  });

  it("renders category description", async () => {
    await renderCategoryPage(BASE_CATEGORY);
    expect(screen.getByText("Conversazioni con esperti.")).toBeInTheDocument();
  });

  it("shows empty state when no articles", async () => {
    await renderCategoryPage({ ...BASE_CATEGORY, articles: [], total: 0 });
    expect(screen.getByText(/nessun articolo/i)).toBeInTheDocument();
  });

  it("renders article titles with links", async () => {
    await renderCategoryPage({
      ...BASE_CATEGORY,
      articles: [SAMPLE_ARTICLE],
      total: 1,
    });
    const link = screen.getByRole("link", { name: "Intervista a Mario Rossi" });
    expect(link).toHaveAttribute("href", "/articoli/intervista-mario-rossi");
  });

  it("renders article excerpt", async () => {
    await renderCategoryPage({
      ...BASE_CATEGORY,
      articles: [SAMPLE_ARTICLE],
      total: 1,
    });
    expect(screen.getByText("Un'intervista incredibile.")).toBeInTheDocument();
  });

  it("calls notFound when category not found", async () => {
    const result = await renderCategoryPage(null);
    expect(result).toBe("notFound");
  });
});
