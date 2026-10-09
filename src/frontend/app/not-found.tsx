import type { Metadata } from "next";
import Link from "next/link";
import { getArticleCards } from "../lib/content";

export const metadata: Metadata = {
  title: { absolute: "Pagina non trovata — Allarounder" },
};

const SUGGESTION_COUNT = 3;

// Rendered for every unknown URL, every notFound() call and the empty
// collection placeholders (lib/static-params.ts). Next adds the noindex tag.
export default function NotFound() {
  const { items } = getArticleCards(1, SUGGESTION_COUNT);

  return (
    <main id="contenuto" className="page-container">
      <header className="page-header">
        <h1>Pagina non trovata</h1>
        <p className="page-lede">
          La pagina che cerchi non esiste o è stata spostata.
        </p>
      </header>
      <p>
        <Link href="/">Torna alla home</Link>
      </p>
      {items.length > 0 && (
        <section aria-labelledby="ultimi-articoli">
          <h2 id="ultimi-articoli">Ultimi articoli</h2>
          <ul>
            {items.map((article) => (
              <li key={article.id}>
                <Link href={`/articoli/${article.slug}`}>{article.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
