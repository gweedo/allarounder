import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryBySlug, getAllCategorySlugs } from "../../../lib/content";
import { formatPublishDate } from "../../../lib/dates";
import { slugParams } from "../../../lib/static-params";
import { emptyPageMetadata } from "../../../lib/seo";

export async function generateStaticParams() {
  return slugParams(getAllCategorySlugs());
}

function getCategoryData(slug: string) {
  const result = getCategoryBySlug(slug);
  if (!result) return null;
  return {
    ...result.detail,
    articles: result.articles,
    total: result.articles.length,
    page: 1,
    page_size: result.articles.length,
  };
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = getCategoryData(slug);
  if (!data) return {};
  return {
    title: { absolute: `${data.name} — Allarounder` },
    description: data.description ?? undefined,
    alternates: { canonical: `https://allarounder.it/argomenti/${data.slug}` },
    ...emptyPageMetadata(data.total),
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const data = getCategoryData(slug);
  if (!data) notFound();

  return (
    <main id="contenuto" className="page-container page-container--wide">
      <header className="page-header">
        <h1>{data.name}</h1>
        {data.description && <p className="page-lede">{data.description}</p>}
        <p className="page-count">
          {data.total} {data.total === 1 ? "articolo" : "articoli"}
        </p>
      </header>
      {data.articles.length === 0 ? (
        <p>Nessun articolo pubblicato in questa categoria.</p>
      ) : (
        <ul className="article-list">
          {data.articles.map((article) => (
            <li key={article.id} className="article-list-item">
              {article.cover_image_url && (
                <div className="cover-image" style={{ height: 200 }}>
                  <Image
                    src={article.cover_image_url}
                    alt={article.cover_image_alt ?? `Copertina: ${article.title}`}
                    fill
                    style={{ objectFit: "cover" }}
                  />
                </div>
              )}
              <h2 className="card-title" style={{ marginTop: "0.75rem" }}>
                <Link href={`/articoli/${article.slug}`}>{article.title}</Link>
              </h2>
              {article.excerpt && (
                <p className="article-excerpt" style={{ marginTop: "0.5rem" }}>
                  {article.excerpt}
                </p>
              )}
              <div className="article-meta" style={{ marginTop: "0.5rem" }}>
                <time dateTime={article.publish_at}>
                  {formatPublishDate(article.publish_at)}
                </time>
                {article.reading_time && (
                  <span style={{ marginLeft: "1rem" }}>{article.reading_time} min di lettura</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
