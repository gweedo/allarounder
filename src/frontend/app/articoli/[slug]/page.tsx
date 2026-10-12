import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { renderMarkdown } from "../../../lib/markdown";
import {
  getArticleBySlug,
  getAllArticleSlugs,
  getRelatedArticles,
} from "../../../lib/content";
import { SPOTIFY_SHOW_URL } from "../../../lib/site";
import { formatPublishDate } from "../../../lib/dates";
import { slugParams } from "../../../lib/static-params";
import { ArticleCard } from "../../_components/ArticleCard";

const BASE = "https://allarounder.it";
const RELATED_COUNT = 3;

export async function generateStaticParams() {
  return slugParams(getAllArticleSlugs());
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};

  const title = article.meta_title ?? `${article.title} — Allarounder`;
  const description = article.meta_description ?? article.excerpt ?? undefined;
  const ogImage = article.og_image_url ?? article.cover_image_url ?? undefined;
  const url = `https://allarounder.it/articoli/${article.slug}`;

  return {
    // Absolute: `title` already ends in "— Allarounder"; the root layout's
    // "%s — Allarounder" template would otherwise append it a second time.
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      images: ogImage ? [{ url: ogImage }] : undefined,
      type: "article",
      url,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const bodyHtml = await renderMarkdown(article.body);
  const url = `${BASE}/articoli/${article.slug}`;
  const related = getRelatedArticles(article, RELATED_COUNT);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    datePublished: article.publish_at,
    dateModified: article.updated_at,
    url,
    ...(article.author_profile
      ? { author: { "@type": "Person", name: article.author_profile.name } }
      : {}),
    ...(article.cover_image_url ? { image: article.cover_image_url } : {}),
    publisher: {
      "@type": "Organization",
      name: "Allarounder",
      url: BASE,
    },
  };

  // The last crumb is the page itself, so it carries no `item` URL.
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { name: "Home", item: BASE },
      ...(article.category
        ? [{ name: article.category.name, item: `${BASE}/argomenti/${article.category.slug}` }]
        : []),
      { name: article.title },
    ].map((crumb, i) => ({ "@type": "ListItem", position: i + 1, ...crumb })),
  };

  return (
    <main id="contenuto" className="page-container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <nav aria-label="Percorso" className="breadcrumb">
        <ol>
          <li>
            <Link href="/">Home</Link>
          </li>
          {article.category && (
            <li>
              <Link href={`/argomenti/${article.category.slug}`}>{article.category.name}</Link>
            </li>
          )}
          <li>
            <span aria-current="page">{article.title}</span>
          </li>
        </ol>
      </nav>
      <article>
        {article.cover_image_url && (
          <div className="cover-image article-cover">
            <Image
              src={article.cover_image_url}
              alt={article.cover_image_alt ?? `Copertina articolo: ${article.title}`}
              fill
              style={{ objectFit: "cover" }}
              priority
            />
          </div>
        )}
        <h1>{article.title}</h1>
        <div className="article-meta article-byline">
          <time dateTime={article.publish_at}>
            {formatPublishDate(article.publish_at)}
          </time>
          {(article.reading_time ?? 0) > 0 && (
            <span>{article.reading_time} min di lettura</span>
          )}
          {article.author_profile && (
            <span>
              di{" "}
              <Link href={`/autori/${article.author_profile.slug}`}>
                {article.author_profile.name}
              </Link>
            </span>
          )}
        </div>
        {article.excerpt && (
          <p className="article-excerpt article-standfirst">
            {article.excerpt}
          </p>
        )}
        {article.tags && article.tags.length > 0 && (
          <div className="tag-list">
            {article.tags.map((tag) => (
              <Link key={tag.id} href={`/tag/${tag.slug}`} className="tag-pill">
                #{tag.name}
              </Link>
            ))}
          </div>
        )}
        {article.guests && article.guests.length > 0 && (
          <div className="article-meta article-guests">
            <span>Ospiti: </span>
            {article.guests.map((guest, i) => (
              <span key={guest.id}>
                <Link href={`/ospiti/${guest.slug}`}>{guest.name}</Link>
                {i < article.guests.length - 1 && ", "}
              </span>
            ))}
          </div>
        )}
        <div
          className="article-body"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
        {article.spotify_url ? (
          <div className="spotify-callout">
            <a href={article.spotify_url} target="_blank" rel="noopener noreferrer">
              Ascolta l&apos;episodio su Spotify
            </a>
          </div>
        ) : (
          SPOTIFY_SHOW_URL && (
            <div className="spotify-callout">
              <a href={SPOTIFY_SHOW_URL} target="_blank" rel="noopener noreferrer">
                Ascolta il podcast su Spotify
              </a>
            </div>
          )
        )}
      </article>
      {article.category && (
        <p className="article-more">
          <Link href={`/argomenti/${article.category.slug}`}>
            Altri articoli in {article.category.name} →
          </Link>
        </p>
      )}
      {related.length > 0 && (
        <section aria-labelledby="leggi-anche" className="related-articles">
          <h2 id="leggi-anche">Leggi anche</h2>
          <ul className="article-grid">
            {related.map((r) => (
              <li key={r.id}>
                <ArticleCard article={r} headingLevel={3} variant="grid" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
