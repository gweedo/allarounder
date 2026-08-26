import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ArticleMeta, ArticleListResult } from "../../lib/content";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

const getArticleCards = vi.fn();
vi.mock("../../lib/content", () => ({
  getArticleCards: (...args: unknown[]) => getArticleCards(...args),
}));

const BASE_ARTICLE: ArticleMeta = {
  id: "art-1",
  title: "Articolo principale",
  slug: "articolo-principale",
  author_id: "author-1",
  publish_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
  spotify_url: null,
  excerpt: "Un estratto interessante",
  cover_image_url: null,
  cover_image_alt: null,
  meta_title: null,
  meta_description: null,
  og_image_url: null,
  reading_time: 5,
  category: null,
  author_profile: null,
  tags: [],
  guests: [],
};

const GRID_ARTICLE: ArticleMeta = {
  ...BASE_ARTICLE,
  id: "art-2",
  title: "Secondo articolo",
  slug: "secondo-articolo",
};

const EMPTY_RESULT: ArticleListResult<ArticleMeta> = { items: [], total: 0, page: 1, page_size: 13 };

async function renderHomePage(data: ArticleListResult<ArticleMeta>) {
  getArticleCards.mockReturnValueOnce(data);
  const { default: HomePage } = await import("../page");
  render(await HomePage());
}

describe("HomePage", () => {
  it("renders site name", async () => {
    await renderHomePage(EMPTY_RESULT);
    expect(screen.getByText(/allarounder/i)).toBeInTheDocument();
  });

  it("renders empty state when no articles", async () => {
    await renderHomePage(EMPTY_RESULT);
    expect(screen.getByText(/nessun articolo pubblicato/i)).toBeInTheDocument();
  });

  it("renders hero article title as h1 on page 1", async () => {
    await renderHomePage({
      items: [BASE_ARTICLE, GRID_ARTICLE],
      total: 2,
      page: 1,
      page_size: 13,
    });
    const heroSection = screen.getByRole("region", { name: /articolo in evidenza/i });
    expect(heroSection).toBeInTheDocument();
    expect(heroSection.querySelector("h2")).toHaveTextContent("Articolo principale");
  });

  it("renders Leggi link in hero pointing to article", async () => {
    await renderHomePage({
      items: [BASE_ARTICLE, GRID_ARTICLE],
      total: 2,
      page: 1,
      page_size: 13,
    });
    const leggiLinks = screen.getAllByRole("link", { name: /leggi/i });
    expect(leggiLinks[0]).toHaveAttribute("href", "/articoli/articolo-principale");
  });

  it("renders grid articles below hero", async () => {
    await renderHomePage({
      items: [BASE_ARTICLE, GRID_ARTICLE],
      total: 2,
      page: 1,
      page_size: 13,
    });
    const grid = screen.getByRole("region", { name: /articoli recenti/i });
    expect(grid).toHaveTextContent("Secondo articolo");
  });

  it("renders placeholder when no cover image", async () => {
    await renderHomePage({
      items: [{ ...BASE_ARTICLE, cover_image_url: null }],
      total: 1,
      page: 1,
      page_size: 13,
    });
    expect(document.querySelector("img")).toBeNull();
  });

  it("renders cover image when present", async () => {
    await renderHomePage({
      items: [{ ...BASE_ARTICLE, cover_image_url: "https://cdn.example.com/img.jpg" }],
      total: 1,
      page: 1,
      page_size: 13,
    });
    expect(document.querySelector("img")).toBeTruthy();
  });

  it("shows category badge in hero", async () => {
    await renderHomePage({
      items: [
        {
          ...BASE_ARTICLE,
          category: { id: "cat-1", name: "Attrezzi", slug: "attrezzi" },
        },
      ],
      total: 1,
      page: 1,
      page_size: 13,
    });
    expect(screen.getByRole("link", { name: "Attrezzi" })).toHaveAttribute(
      "href",
      "/argomenti/attrezzi",
    );
  });

  it("shows author name in hero", async () => {
    await renderHomePage({
      items: [
        {
          ...BASE_ARTICLE,
          author_profile: { id: "aut-1", name: "Marco Rossi", slug: "marco-rossi" },
        },
      ],
      total: 1,
      page: 1,
      page_size: 13,
    });
    expect(screen.getByRole("link", { name: "Marco Rossi" })).toHaveAttribute(
      "href",
      "/autori/marco-rossi",
    );
  });

  it("shows pagination when totalPages > 1", async () => {
    await renderHomePage({
      items: [BASE_ARTICLE],
      total: 30,
      page: 1,
      page_size: 13,
    });
    expect(screen.getByRole("navigation", { name: /paginazione/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /pagina successiva/i })).toHaveAttribute(
      "href",
      "/?page=2",
    );
  });

});
