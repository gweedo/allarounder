import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getCategoryBySlug, getAllCategorySlugs } from "../../../lib/content";

export async function generateStaticParams() {
  return getAllCategorySlugs().map((slug) => ({ slug }));
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
    title: `${data.name} — Allarounder`,
    description: data.description ?? undefined,
    alternates: { canonical: `https://allarounder.it/argomenti/${data.slug}` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const data = getCategoryData(slug);
  if (!data) notFound();

  return (
    <main className="page-container page-container--wide">
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
                <a href={`/articoli/${article.slug}`}>{article.title}</a>
              </h2>
              {article.excerpt && (
                <p className="article-excerpt" style={{ marginTop: "0.5rem" }}>
                  {article.excerpt}
                </p>
              )}
              <div className="article-meta" style={{ marginTop: "0.5rem" }}>
                <time dateTime={article.publish_at}>
                  {new Date(article.publish_at).toLocaleDateString("it-IT")}
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
