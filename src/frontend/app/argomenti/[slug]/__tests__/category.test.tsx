import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const getCategoryBySlug = vi.fn();
vi.mock("../../../../lib/content", () => ({
  getCategoryBySlug: (slug: string) => getCategoryBySlug(slug),
  getAllCategorySlugs: () => [],
}));

const BASE_DETAIL = {
  id: "cat-1",
  name: "Interviste",
  slug: "interviste",
  description: "Conversazioni con esperti." as string | null,
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

async function renderCategoryPage(
  data: { detail: typeof BASE_DETAIL; articles: typeof SAMPLE_ARTICLE[] } | null,
) {
  const CategoryPage = (await import("../page")).default;
  getCategoryBySlug.mockReturnValueOnce(data);
  try {
    render(
      await CategoryPage({
        params: Promise.resolve({ slug: data?.detail.slug ?? "missing" }),
      }),
    );
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_NOT_FOUND") return "notFound";
    throw e;
  }
  return "rendered";
}

describe("CategoryPage", () => {
  it("renders category name as heading", async () => {
    await renderCategoryPage({ detail: BASE_DETAIL, articles: [] });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Interviste");
  });

  it("renders category description", async () => {
    await renderCategoryPage({ detail: BASE_DETAIL, articles: [] });
    expect(screen.getByText("Conversazioni con esperti.")).toBeInTheDocument();
  });

  it("shows empty state when no articles", async () => {
    await renderCategoryPage({ detail: BASE_DETAIL, articles: [] });
    expect(screen.getByText(/nessun articolo/i)).toBeInTheDocument();
  });

  it("renders article titles with links", async () => {
    await renderCategoryPage({ detail: BASE_DETAIL, articles: [SAMPLE_ARTICLE] });
    const link = screen.getByRole("link", { name: "Intervista a Mario Rossi" });
    expect(link).toHaveAttribute("href", "/articoli/intervista-mario-rossi");
  });

  it("renders article excerpt", async () => {
    await renderCategoryPage({ detail: BASE_DETAIL, articles: [SAMPLE_ARTICLE] });
    expect(screen.getByText("Un'intervista incredibile.")).toBeInTheDocument();
  });

  it("calls notFound when category not found", async () => {
    const result = await renderCategoryPage(null);
    expect(result).toBe("notFound");
  });
});

describe("generateMetadata", () => {
  it("returns title and description for existing category", async () => {
    getCategoryBySlug.mockReturnValueOnce({ detail: BASE_DETAIL, articles: [] });
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "interviste" }) });
    expect(meta.title).toBe("Interviste — Allarounder");
    expect(meta.description).toBe("Conversazioni con esperti.");
  });

  it("returns undefined description when category description is null", async () => {
    getCategoryBySlug.mockReturnValueOnce({
      detail: { ...BASE_DETAIL, description: null },
      articles: [],
    });
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "interviste" }) });
    expect(meta.description).toBeUndefined();
  });

  it("returns empty object when category not found", async () => {
    getCategoryBySlug.mockReturnValueOnce(null);
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "missing" }) });
    expect(meta).toEqual({});
  });
});
