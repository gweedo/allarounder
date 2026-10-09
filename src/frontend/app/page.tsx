import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getArticleCards } from "../lib/content";
import { formatPublishDate } from "../lib/dates";

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

  return (
    <main id="contenuto" className="page-container page-container--wide">
      {/* The site header shows the brand; this h1 only names the page for
          screen readers and search engines. */}
      <h1 className="visually-hidden">Allarounder</h1>

      {hero && (
        <section className="hero" aria-label="Articolo in evidenza">
          {hero.cover_image_url ? (
            <div className="cover-image" style={{ height: 400 }}>
              <Image
                src={hero.cover_image_url}
                alt={hero.cover_image_alt ?? `Copertina: ${hero.title}`}
                fill
                style={{ objectFit: "cover" }}
                priority
              />
            </div>
          ) : (
            <div className="cover-image" aria-hidden="true" style={{ height: 300 }} />
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
          <div className="article-meta" style={{ marginBottom: "1rem" }}>
            <time dateTime={hero.publish_at}>
              {formatPublishDate(hero.publish_at)}
            </time>
            {hero.author_profile && (
              <span style={{ marginLeft: "1rem" }}>
                di <Link href={`/autori/${hero.author_profile.slug}`}>{hero.author_profile.name}</Link>
              </span>
            )}
          </div>
          <Link href={`/articoli/${hero.slug}`} className="hero-cta">
            Leggi
          </Link>
        </section>
      )}

      {grid.length > 0 && (
        <section aria-label="Articoli recenti">
          <ul className="card-grid">
            {grid.map((article) => (
              <li key={article.id}>
                {article.cover_image_url ? (
                  <div className="cover-image" style={{ height: 180 }}>
                    <Image
                      src={article.cover_image_url}
                      alt={article.cover_image_alt ?? `Copertina: ${article.title}`}
                      fill
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                ) : (
                  <div className="cover-image" aria-hidden="true" style={{ height: 180 }} />
                )}
                {article.category && (
                  <Link
                    href={`/argomenti/${article.category.slug}`}
                    className="category-badge category-badge--muted"
                  >
                    {article.category.name}
                  </Link>
                )}
                <h2 className="card-title" style={{ fontSize: "1rem" }}>
                  <Link href={`/articoli/${article.slug}`}>{article.title}</Link>
                </h2>
                {article.excerpt && (
                  <p
                    className="article-excerpt"
                    style={{
                      fontSize: "0.875rem",
                      margin: "0 0 0.5rem",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {article.excerpt}
                  </p>
                )}
                <div className="article-meta">
                  <time dateTime={article.publish_at}>
                    {formatPublishDate(article.publish_at)}
                  </time>
                  {article.author_profile && (
                    <span style={{ marginLeft: "0.75rem" }}>
                      {article.author_profile.name}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.total === 0 && (
        <p className="page-lede" style={{ textAlign: "center", marginTop: "4rem" }}>
          Nessun articolo pubblicato.
        </p>
      )}

      {data.total > 0 && (
        <p className="article-more">
          <Link href="/articoli">Tutti gli articoli →</Link>
        </p>
      )}
    </main>
  );
}
