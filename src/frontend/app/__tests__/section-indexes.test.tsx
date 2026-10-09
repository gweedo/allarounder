import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ArticleMeta } from "../../lib/content";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/image", () => ({ default: () => null }));

const ARTICLE = {
  id: "a1",
  slug: "appunti-di-agonismo",
  title: "Appunti di Agonismo",
  publish_at: "2026-10-05T22:00:00Z",
  excerpt: null,
  cover_image_url: null,
  reading_time: 7,
  category: { id: "c", name: "Out of the Box", slug: "out-of-the-box" },
  author_profile: { id: "p", name: "Chiara Simonelli", slug: "chiara-simonelli" },
} as ArticleMeta;

const content = vi.hoisted(() => ({
  articles: [] as unknown[],
}));
vi.mock("../../lib/content", () => ({
  getArticleCards: () => ({ items: content.articles, total: content.articles.length, page: 1, page_size: 0 }),
  getCategoryIndex: () => [{ id: "c", name: "Analisi", slug: "analisi", description: null, article_count: 0 }],
  getAuthorIndex: () => [{ id: "p", name: "Chiara Simonelli", slug: "chiara-simonelli", article_count: 1 }],
  getGuestIndex: () => [],
  getTagIndex: () => [{ id: "t", name: "agonismo", slug: "agonismo", article_count: 1 }],
}));

describe("section index pages", () => {
  it("/articoli lists every published article", async () => {
    content.articles = [ARTICLE];
    const { default: Page, generateMetadata } = await import("../articoli/page");
    render(<Page />);
    const metadata = generateMetadata();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Articoli");
    expect(screen.getByRole("link", { name: "Appunti di Agonismo" })).toHaveAttribute(
      "href",
      "/articoli/appunti-di-agonismo",
    );
    expect(metadata.title).toEqual({ absolute: "Articoli — Allarounder" });
    expect(metadata.alternates?.canonical).toBe("https://allarounder.it/articoli");
  });

  it("/articoli has an empty state and stays out of the index while empty", async () => {
    content.articles = [];
    const { default: Page, generateMetadata } = await import("../articoli/page");
    render(<Page />);
    expect(screen.getByText(/nessun articolo pubblicato/i)).toBeInTheDocument();
    expect(generateMetadata().robots).toEqual({ index: false, follow: true });
  });

  it.each([
    ["argomenti", "Argomenti", "Analisi", "/argomenti/analisi"],
    ["autori", "Autori", "Chiara Simonelli", "/autori/chiara-simonelli"],
    ["tag", "Tag", "#agonismo", "/tag/agonismo"],
  ])("/%s lists its entries", async (dir, title, linkName, href) => {
    const { default: Page, generateMetadata } = await import(`../${dir}/page.tsx`);
    render(<Page />);
    const metadata = generateMetadata();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
    expect(screen.getByRole("link", { name: linkName })).toHaveAttribute("href", href);
    expect(metadata.title).toEqual({ absolute: `${title} — Allarounder` });
    expect(metadata.alternates.canonical).toBe(`https://allarounder.it/${dir}`);
    expect(metadata.robots).toBeUndefined();
  });

  it("/ospiti shows an empty state and stays out of the index while there are no guests", async () => {
    const { default: Page, generateMetadata } = await import("../ospiti/page");
    render(<Page />);
    expect(generateMetadata().robots).toEqual({ index: false, follow: true });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ospiti");
    expect(screen.getByText(/nessun ospite/i)).toBeInTheDocument();
  });
});
