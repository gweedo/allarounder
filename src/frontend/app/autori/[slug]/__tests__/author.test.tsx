import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const getAuthorBySlug = vi.fn();
vi.mock("../../../../lib/content", () => ({
  getAuthorBySlug: (slug: string) => getAuthorBySlug(slug),
  getAllAuthorSlugs: () => [],
}));

const BASE_DETAIL = {
  id: "a1",
  name: "Marco Rossi",
  slug: "marco-rossi",
  bio: "Giornalista sportivo." as string | null,
  photo_url: null as string | null,
  links: {} as Record<string, string>,
};

async function renderAuthorPage(
  data: { detail: typeof BASE_DETAIL; articles: Record<string, unknown>[] } | null,
) {
  const AuthorPage = (await import("../page")).default;
  getAuthorBySlug.mockReturnValueOnce(data);

  try {
    render(
      await AuthorPage({
        params: Promise.resolve({ slug: data?.detail.slug ?? "missing" }),
      }),
    );
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_NOT_FOUND") return "notFound";
    throw e;
  }
  return "rendered";
}

describe("AuthorPage", () => {
  it("renders author name as heading", async () => {
    await renderAuthorPage({ detail: BASE_DETAIL, articles: [] });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Marco Rossi");
  });

  it("renders author bio", async () => {
    await renderAuthorPage({ detail: BASE_DETAIL, articles: [] });
    expect(screen.getByText("Giornalista sportivo.")).toBeInTheDocument();
  });

  it("renders photo when photo_url is set", async () => {
    await renderAuthorPage({
      detail: { ...BASE_DETAIL, photo_url: "https://cdn.allarounder.it/authors/marco.jpg" },
      articles: [],
    });
    const img = document.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toContain(encodeURIComponent("https://cdn.allarounder.it/authors/marco.jpg"));
  });

  it("renders empty state when no articles", async () => {
    await renderAuthorPage({ detail: BASE_DETAIL, articles: [] });
    expect(screen.getByText(/nessun articolo/i)).toBeInTheDocument();
  });

  it("renders article list with links", async () => {
    await renderAuthorPage({
      detail: BASE_DETAIL,
      articles: [
        {
          id: "art-1",
          title: "Articolo di test",
          slug: "articolo-di-test",
          excerpt: "Un estratto",
          cover_image_url: null,
          cover_image_alt: null,
          reading_time: 3,
          publish_at: "2026-06-01T00:00:00Z",
        },
      ],
    });
    const link = screen.getByRole("link", { name: "Articolo di test" });
    expect(link).toHaveAttribute("href", "/articoli/articolo-di-test");
    expect(screen.getByText("Un estratto")).toBeInTheDocument();
  });

  it("renders social links", async () => {
    await renderAuthorPage({
      detail: { ...BASE_DETAIL, links: { Twitter: "https://twitter.com/marco" } },
      articles: [],
    });
    const link = screen.getByRole("link", { name: "Twitter" });
    expect(link).toHaveAttribute("href", "https://twitter.com/marco");
  });

  it("calls notFound when author not found", async () => {
    const result = await renderAuthorPage(null);
    expect(result).toBe("notFound");
  });
});

describe("generateMetadata", () => {
  it("returns title and bio as description when bio is set", async () => {
    getAuthorBySlug.mockReturnValueOnce({ detail: BASE_DETAIL, articles: [] });
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "marco-rossi" }) });
    expect(meta.title).toBe("Marco Rossi — Allarounder");
    expect(meta.description).toBe("Giornalista sportivo.");
  });

  it("returns fallback description when bio is null", async () => {
    getAuthorBySlug.mockReturnValueOnce({ detail: { ...BASE_DETAIL, bio: null }, articles: [] });
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "marco-rossi" }) });
    expect(meta.description).toBe("Articoli di Marco Rossi su Allarounder");
  });

  it("returns empty object when author not found", async () => {
    getAuthorBySlug.mockReturnValueOnce(null);
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "missing" }) });
    expect(meta).toEqual({});
  });
});
