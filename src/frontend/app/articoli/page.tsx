import type { Metadata } from "next";
import { getArticleCards } from "../../lib/content";
import { emptyPageMetadata } from "../../lib/seo";
import { ArticleList } from "../_components/ArticleList";

export function generateMetadata(): Metadata {
  return {
    title: { absolute: "Articoli — Allarounder" },
    description: "Tutti gli articoli di Allarounder, dal più recente.",
    alternates: { canonical: "https://allarounder.it/articoli" },
    ...emptyPageMetadata(getArticleCards(1, 1).total),
  };
}

// Every published article on one page, newest first. Path-based pagination
// (/articoli/pagina/[n]) can follow once the list gets long.
export default function ArticlesIndexPage() {
  const { items, total } = getArticleCards(1, Number.MAX_SAFE_INTEGER);

  return (
    <main id="contenuto" className="page-container page-container--wide">
      <header className="page-header">
        <h1>Articoli</h1>
        <p className="page-count">
          {total} {total === 1 ? "articolo" : "articoli"}
        </p>
      </header>
      {items.length === 0 ? <p>Nessun articolo pubblicato.</p> : <ArticleList articles={items} />}
    </main>
  );
}
