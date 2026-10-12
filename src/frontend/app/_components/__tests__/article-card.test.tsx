import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { ArticleMeta } from "../../../lib/content";
import { ArticleCard } from "../ArticleCard";
import { ArticleList } from "../ArticleList";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const ARTICLE: ArticleMeta = {
  id: "art-1",
  title: "Intervista a Mario Rossi",
  slug: "intervista-mario-rossi",
  author_id: "author-1",
  publish_at: "2026-06-01T10:00:00Z",
  updated_at: "2026-06-01T10:00:00Z",
  spotify_url: null,
  excerpt: "Un'intervista incredibile.",
  cover_image_url: null,
  cover_image_alt: null,
  meta_title: null,
  meta_description: null,
  og_image_url: null,
  reading_time: 7,
  category: { id: "cat-1", name: "Interviste", slug: "interviste" },
  author_profile: { id: "author-1", name: "Marco Bianchi", slug: "marco-bianchi" },
  tags: [],
  guests: [],
};

describe("ArticleCard", () => {
  it("links the title to the Article and the label to its Category", () => {
    render(<ArticleCard article={ARTICLE} headingLevel={3} variant="grid" />);
    const heading = screen.getByRole("heading", { level: 3 });
    expect(within(heading).getByRole("link")).toHaveAttribute("href", "/articoli/intervista-mario-rossi");
    expect(screen.getByRole("link", { name: "Interviste" })).toHaveAttribute("href", "/argomenti/interviste");
    expect(screen.getByText("Un'intervista incredibile.")).toBeInTheDocument();
  });

  it("names the score tile by its reading time, hiding the decorative digits", () => {
    render(<ArticleCard article={ARTICLE} headingLevel={2} variant="grid" />);
    const tile = screen.getByRole("img", { name: "7 minuti di lettura" });
    expect(within(tile).getByText("07")).toHaveAttribute("aria-hidden", "true");
    expect(within(tile).getByText("min")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses the singular for a one-minute read", () => {
    render(<ArticleCard article={{ ...ARTICLE, reading_time: 1 }} headingLevel={2} variant="grid" />);
    expect(screen.getByRole("img", { name: "1 minuto di lettura" })).toBeInTheDocument();
  });

  it.each([null, 0])("shows no tile and no reading time when it is %s", (reading_time) => {
    render(<ArticleCard article={{ ...ARTICLE, reading_time }} headingLevel={2} variant="grid" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByText(/min di lettura/)).toBeNull();
  });

  it("shows the Cover image in place of the tile", () => {
    render(
      <ArticleCard
        article={{ ...ARTICLE, cover_image_url: "https://cdn.example.com/c.jpg", cover_image_alt: "Trave" }}
        headingLevel={2}
        variant="grid"
      />,
    );
    expect(screen.getByRole("img", { name: "Trave" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /minut/ })).toBeNull();
  });

  it("names the Author only in the list variant", () => {
    const { unmount } = render(<ArticleCard article={ARTICLE} headingLevel={2} variant="grid" />);
    expect(screen.queryByText("di Marco Bianchi")).toBeNull();
    unmount();
    render(<ArticleCard article={ARTICLE} headingLevel={2} variant="list" />);
    expect(screen.getByText("di Marco Bianchi")).toBeInTheDocument();
  });
});

describe("ArticleList", () => {
  it("renders one list-variant card per Article, titled with h2", () => {
    render(<ArticleList articles={[ARTICLE, { ...ARTICLE, id: "art-2", title: "Secondo" }]} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByRole("heading", { level: 2 })).toHaveTextContent("Intervista a Mario Rossi");
    expect(within(items[0]).getByText("di Marco Bianchi")).toBeInTheDocument();
  });
});
