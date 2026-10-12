import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

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
  cover_image_url: null as string | null,
  cover_image_alt: null as string | null,
  reading_time: 5 as number | null,
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

  it("shows the reading time on a score tile, announced in words", async () => {
    await renderCategoryPage({
      detail: BASE_DETAIL,
      articles: [{ ...SAMPLE_ARTICLE, reading_time: 7 }],
    });
    const tile = screen.getByRole("img", { name: "7 minuti di lettura" });
    expect(within(tile).getByText("07")).toHaveAttribute("aria-hidden", "true");
    expect(within(tile).getByText("min")).toHaveAttribute("aria-hidden", "true");
    // The meta row repeats it in text, so nothing depends on the tile alone.
    expect(screen.getByText("7 min di lettura")).toBeInTheDocument();
  });

  it.each([null, 0])("shows no tile and no stray digit when the reading time is %s", async (reading_time) => {
    await renderCategoryPage({
      detail: BASE_DETAIL,
      articles: [{ ...SAMPLE_ARTICLE, reading_time }],
    });
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByText(/min di lettura/)).toBeNull();
    expect(screen.queryByText(/^0+$/)).toBeNull();
  });

  it("renders no image block for an article without a cover image", async () => {
    await renderCategoryPage({ detail: BASE_DETAIL, articles: [SAMPLE_ARTICLE] });
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("[aria-hidden='true']:empty")).toBeNull();
  });

  it("shows the cover image in place of the tile", async () => {
    await renderCategoryPage({
      detail: BASE_DETAIL,
      articles: [
        {
          ...SAMPLE_ARTICLE,
          cover_image_url: "https://cdn.example.com/cover.jpg",
          cover_image_alt: "Mario Rossi alla trave",
        },
      ],
    });
    expect(screen.getByRole("img", { name: "Mario Rossi alla trave" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /minut/ })).toBeNull();
  });

  it("titles each article card with an h2", async () => {
    await renderCategoryPage({ detail: BASE_DETAIL, articles: [SAMPLE_ARTICLE] });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Intervista a Mario Rossi");
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
    expect(meta.title).toEqual({ absolute: "Interviste — Allarounder" });
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

  it("keeps an empty category out of search results but lets crawlers follow its links", async () => {
    getCategoryBySlug.mockReturnValueOnce({ detail: BASE_DETAIL, articles: [] });
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "interviste" }) });
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it("lets a category with articles be indexed", async () => {
    getCategoryBySlug.mockReturnValueOnce({ detail: BASE_DETAIL, articles: [SAMPLE_ARTICLE] });
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "interviste" }) });
    expect(meta.robots).toBeUndefined();
  });

  it("returns empty object when category not found", async () => {
    getCategoryBySlug.mockReturnValueOnce(null);
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "missing" }) });
    expect(meta).toEqual({});
  });
});
