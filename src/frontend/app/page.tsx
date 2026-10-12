import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getArticleCards } from "../lib/content";
import { formatPublishDate } from "../lib/dates";
import { readingMinutes } from "../lib/reading-time";
import { ArticleCard } from "./_components/ArticleCard";

export const metadata: Metadata = {
  title: "Allarounder — La voce italiana sulla ginnastica artistica",
  description: "La voce italiana sulla ginnastica artistica.",
  alternates: { canonical: "https://allarounder.it" },
};

// Hero + grid of the latest articles; the full list lives at /articoli.
const LATEST_COUNT = 13;

export default async function HomePage() {
  const data = getArticleCards(1, LATEST_COUNT);
  const hero = data.items[0] ?? null;
  const grid = data.items.slice(1);
  const heroMinutes = hero && readingMinutes(hero);

  return (
    <main id="contenuto" className="page-container page-container--wide">
      {/* The site header shows the brand; this h1 only names the page for
          screen readers and search engines. */}
      <h1 className="visually-hidden">Allarounder</h1>

      <div className="home-layout">
        {hero && (
          <section
            className={hero.cover_image_url ? "hero" : "hero hero--ruled"}
            aria-label="Articolo in evidenza"
          >
            {hero.cover_image_url && (
              <div className="hero__cover">
                <Image
                  src={hero.cover_image_url}
                  alt={hero.cover_image_alt ?? `Copertina: ${hero.title}`}
                  fill
                  sizes="(max-width: 1100px) 100vw, 1100px"
                  style={{ objectFit: "cover" }}
                  priority
                />
              </div>
            )}
            {hero.category && (
              <Link href={`/argomenti/${hero.category.slug}`} className="category-badge">
                {hero.category.name}
              </Link>
            )}
            <h2 className="hero-title">
              <Link href={`/articoli/${hero.slug}`}>{hero.title}</Link>
            </h2>
            {hero.excerpt && <p className="hero-excerpt">{hero.excerpt}</p>}
            <p className="article-meta hero__meta">
              <time dateTime={hero.publish_at}>{formatPublishDate(hero.publish_at)}</time>
              {hero.author_profile && (
                <span>
                  di{" "}
                  <Link href={`/autori/${hero.author_profile.slug}`}>
                    {hero.author_profile.name}
                  </Link>
                </span>
              )}
              {heroMinutes && <span>{heroMinutes} min di lettura</span>}
            </p>
            <Link href={`/articoli/${hero.slug}`} className="hero-cta">
              Leggi
            </Link>
          </section>
        )}

        {grid.length > 0 && (
          <section aria-label="Articoli recenti">
            <ul className="article-grid">
              {grid.map((article) => (
                <li key={article.id}>
                  <ArticleCard article={article} headingLevel={2} variant="grid" />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {data.total === 0 && <p className="page-lede page-empty">Nessun articolo pubblicato.</p>}

      {data.total > 0 && (
        <p className="article-more">
          <Link href="/articoli">Tutti gli articoli →</Link>
        </p>
      )}
    </main>
  );
}
