import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { ArticleMeta } from "../../lib/content";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const getArticleCards = vi.fn();
vi.mock("../../lib/content", () => ({
  getArticleCards: (...args: unknown[]) => getArticleCards(...args),
}));

const ARTICLE = {
  id: "art-1",
  title: "Appunti di Agonismo",
  slug: "appunti-di-agonismo",
} as ArticleMeta;

async function renderNotFound(items: ArticleMeta[]) {
  getArticleCards.mockReturnValueOnce({ items, total: items.length, page: 1, page_size: 3 });
  const { default: NotFound } = await import("../not-found");
  render(<NotFound />);
}

describe("NotFound", () => {
  it("explains in Italian that the page does not exist", async () => {
    await renderNotFound([]);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Pagina non trovata");
  });

  it("is the main landmark and the skip-link target", async () => {
    await renderNotFound([]);
    expect(screen.getByRole("main")).toHaveAttribute("id", "contenuto");
  });

  it("links back to the home page", async () => {
    await renderNotFound([]);
    expect(screen.getByRole("link", { name: /torna alla home/i })).toHaveAttribute("href", "/");
  });

  it("suggests the latest articles so the reader can carry on", async () => {
    await renderNotFound([ARTICLE]);
    expect(getArticleCards).toHaveBeenLastCalledWith(1, 3);
    const list = screen.getByRole("region", { name: /ultimi articoli/i });
    expect(within(list).getByRole("link", { name: "Appunti di Agonismo" })).toHaveAttribute(
      "href",
      "/articoli/appunti-di-agonismo",
    );
  });

  it("omits the suggestions when nothing is published", async () => {
    await renderNotFound([]);
    expect(screen.queryByRole("region", { name: /ultimi articoli/i })).toBeNull();
  });
});
