import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const getTagBySlug = vi.fn();
vi.mock("../../../../lib/content", () => ({
  getTagBySlug: (slug: string) => getTagBySlug(slug),
  getAllTagSlugs: () => [],
}));

const BASE_DETAIL = { id: "tag-1", name: "calcio", slug: "calcio" };

async function renderTagPage(
  data: { detail: typeof BASE_DETAIL; articles: Record<string, unknown>[] } | null,
) {
  const TagPage = (await import("../page")).default;
  getTagBySlug.mockReturnValueOnce(data);

  try {
    render(
      await TagPage({
        params: Promise.resolve({ slug: data?.detail.slug ?? "missing" }),
      }),
    );
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_NOT_FOUND") return "notFound";
    throw e;
  }
  return "rendered";
}

describe("TagPage", () => {
  it("renders tag name as heading", async () => {
    await renderTagPage({ detail: BASE_DETAIL, articles: [] });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("#calcio");
  });

  it("renders article count", async () => {
    await renderTagPage({
      detail: BASE_DETAIL,
      articles: [{}, {}, {}],
    });
    expect(screen.getByText(/3 articoli/i)).toBeInTheDocument();
  });

  it("renders empty state when no articles", async () => {
    await renderTagPage({ detail: BASE_DETAIL, articles: [] });
    expect(screen.getByText(/nessun articolo/i)).toBeInTheDocument();
  });

  it("renders article list with links", async () => {
    await renderTagPage({
      detail: BASE_DETAIL,
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

describe("generateMetadata", () => {
  it("returns title and description for existing tag", async () => {
    getTagBySlug.mockReturnValueOnce({ detail: BASE_DETAIL, articles: [] });
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "calcio" }) });
    expect(meta.title).toBe("calcio — Allarounder");
    expect(meta.description).toBe('Articoli con il tag "calcio"');
  });

  it("returns empty object when tag not found", async () => {
    getTagBySlug.mockReturnValueOnce(null);
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "missing" }) });
    expect(meta).toEqual({});
  });
});
