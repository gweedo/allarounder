import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

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

interface TestArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  publish_at: string;
  reading_time: number | null;
  category: { id: string; name: string; slug: string } | null;
  author_profile: { id: string; name: string; slug: string } | null;
}

interface TestResponse {
  items: TestArticle[];
  total: number;
  page: number;
  page_size: number;
}

const BASE_ARTICLE: TestArticle = {
  id: "art-1",
  title: "Articolo principale",
  slug: "articolo-principale",
  excerpt: "Un estratto interessante",
  cover_image_url: null,
  cover_image_alt: null,
  publish_at: "2026-06-01T00:00:00Z",
  reading_time: 5,
  category: null,
  author_profile: null,
};

const GRID_ARTICLE: TestArticle = {
  ...BASE_ARTICLE,
  id: "art-2",
  title: "Secondo articolo",
  slug: "secondo-articolo",
};

const EMPTY_RESPONSE: TestResponse = { items: [], total: 0, page: 1, page_size: 13 };

beforeEach(() => {
  global.fetch = vi.fn();
  vi.resetModules();
});

async function renderHomePage(data: TestResponse, page = "1") {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  });
  const { default: HomePage } = await import("../page");
  render(await HomePage({ searchParams: Promise.resolve({ page }) }));
}

describe("HomePage", () => {
  it("renders site name", async () => {
    await renderHomePage(EMPTY_RESPONSE);
    expect(screen.getByText(/allarounder/i)).toBeInTheDocument();
  });

  it("renders empty state when no articles", async () => {
    await renderHomePage(EMPTY_RESPONSE);
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
    expect(heroSection.querySelector("h1")).toHaveTextContent("Articolo principale");
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

  it("shows previous page link on page 2", async () => {
    await renderHomePage(
      { items: [GRID_ARTICLE], total: 30, page: 2, page_size: 13 },
      "2",
    );
    expect(screen.getByRole("link", { name: /pagina precedente/i })).toHaveAttribute(
      "href",
      "/?page=1",
    );
  });

  it("no hero on page 2", async () => {
    await renderHomePage(
      { items: [GRID_ARTICLE], total: 30, page: 2, page_size: 13 },
      "2",
    );
    expect(screen.queryByRole("region", { name: /articolo in evidenza/i })).toBeNull();
  });
});
