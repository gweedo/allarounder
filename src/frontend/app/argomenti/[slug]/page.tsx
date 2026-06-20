import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const revalidate = 60;

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  reading_time: number | null;
  publish_at: string;
}

interface CategoryWithArticles {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  articles: Article[];
  total: number;
  page: number;
  page_size: number;
}

async function getCategoryData(slug: string): Promise<CategoryWithArticles | null> {
  const apiUrl = process.env.API_URL ?? "http://backend:8000";
  try {
    const res = await fetch(`${apiUrl}/api/categories/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as CategoryWithArticles;
  } catch {
    return null;
  }
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCategoryData(slug);
  if (!data) return {};
  return {
    title: `${data.name} — Allarounder`,
    description: data.description ?? undefined,
    alternates: { canonical: `https://allarounder.it/argomenti/${data.slug}` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const data = await getCategoryData(slug);
  if (!data) notFound();

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
      <header style={{ marginBottom: "2rem" }}>
        <h1>{data.name}</h1>
        {data.description && (
          <p style={{ color: "#555", fontSize: "1.1rem" }}>{data.description}</p>
        )}
        <p style={{ color: "#888" }}>
          {data.total} {data.total === 1 ? "articolo" : "articoli"}
        </p>
      </header>
      {data.articles.length === 0 ? (
        <p>Nessun articolo pubblicato in questa categoria.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "1.5rem" }}>
          {data.articles.map((article) => (
            <li key={article.id} style={{ borderBottom: "1px solid #eee", paddingBottom: "1.5rem" }}>
              {article.cover_image_url && (
                <img
                  src={article.cover_image_url}
                  alt={article.cover_image_alt ?? `Copertina: ${article.title}`}
                  style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 6 }}
                />
              )}
              <h2 style={{ marginTop: "0.75rem" }}>
                <a
                  href={`/articoli/${article.slug}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  {article.title}
                </a>
              </h2>
              {article.excerpt && (
                <p style={{ color: "#555", marginTop: "0.5rem" }}>{article.excerpt}</p>
              )}
              <div style={{ color: "#888", fontSize: "0.875rem", marginTop: "0.5rem" }}>
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
