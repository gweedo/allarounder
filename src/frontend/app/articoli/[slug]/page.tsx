import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { renderMarkdown } from "../../../lib/markdown";
import { getArticleBySlug, getAllArticleSlugs } from "../../../lib/content";

export async function generateStaticParams() {
  return getAllArticleSlugs().map((slug) => ({ slug }));
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
    title,
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
  const url = `https://allarounder.it/articoli/${article.slug}`;

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
      url: "https://allarounder.it",
    },
  };

  return (
    <main className="page-container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article>
        {article.cover_image_url && (
          <div className="cover-image" style={{ aspectRatio: "16/9", marginBottom: "1.5rem" }}>
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
        <div className="article-meta" style={{ marginTop: "0.25rem" }}>
          <time dateTime={article.publish_at}>
            {new Date(article.publish_at).toLocaleDateString("it-IT")}
          </time>
          {article.reading_time && (
            <span style={{ marginLeft: "1rem" }}>
              {article.reading_time} min di lettura
            </span>
          )}
          {article.author_profile && (
            <span style={{ marginLeft: "1rem" }}>
              di{" "}
              <a href={`/autori/${article.author_profile.slug}`}>
                {article.author_profile.name}
              </a>
            </span>
          )}
        </div>
        {article.category && (
          <p className="article-meta" style={{ marginTop: "0.5rem" }}>
            <a href={`/argomenti/${article.category.slug}`}>{article.category.name}</a>
          </p>
        )}
        {article.excerpt && (
          <p className="article-excerpt" style={{ fontStyle: "italic", marginTop: "1rem" }}>
            {article.excerpt}
          </p>
        )}
        {article.tags && article.tags.length > 0 && (
          <div className="tag-list">
            {article.tags.map((tag) => (
              <a key={tag.id} href={`/tag/${tag.slug}`} className="tag-pill">
                #{tag.name}
              </a>
            ))}
          </div>
        )}
        {article.guests && article.guests.length > 0 && (
          <div className="article-meta" style={{ marginTop: "1rem" }}>
            <span>Ospiti: </span>
            {article.guests.map((guest, i) => (
              <span key={guest.id}>
                <a href={`/ospiti/${guest.slug}`}>{guest.name}</a>
                {i < article.guests.length - 1 && ", "}
              </span>
            ))}
          </div>
        )}
        <div
          className="article-body"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
        {article.spotify_url && (
          <div className="spotify-callout">
            <a href={article.spotify_url} target="_blank" rel="noopener noreferrer">
              Ascolta su Spotify
            </a>
          </div>
        )}
      </article>
    </main>
  );
}
