import type { Metadata } from "next";
import Image from "next/image";
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

interface TagWithArticles {
  id: string;
  name: string;
  slug: string;
  articles: Article[];
  total: number;
  page: number;
  page_size: number;
}

async function getTagData(slug: string): Promise<TagWithArticles | null> {
  const apiUrl = process.env.API_URL ?? "http://backend:8000";
  try {
    const res = await fetch(`${apiUrl}/api/tags/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as TagWithArticles;
  } catch {
    return null;
  }
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getTagData(slug);
  if (!data) return {};
  return {
    title: `${data.name} — Allarounder`,
    description: `Articoli con il tag "${data.name}"`,
    alternates: { canonical: `https://allarounder.it/tag/${data.slug}` },
  };
}

export default async function TagPage({ params }: Props) {
  const { slug } = await params;
  const data = await getTagData(slug);
  if (!data) notFound();

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
      <header style={{ marginBottom: "2rem" }}>
        <h1>#{data.name}</h1>
        <p style={{ color: "#888" }}>
          {data.total} {data.total === 1 ? "articolo" : "articoli"}
        </p>
      </header>
      {data.articles.length === 0 ? (
        <p>Nessun articolo pubblicato con questo tag.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "1.5rem" }}>
          {data.articles.map((article) => (
            <li key={article.id} style={{ borderBottom: "1px solid #eee", paddingBottom: "1.5rem" }}>
              {article.cover_image_url && (
                <div style={{ position: "relative", width: "100%", height: 200 }}>
                  <Image
                    src={article.cover_image_url}
                    alt={article.cover_image_alt ?? `Copertina: ${article.title}`}
                    fill
                    style={{ objectFit: "cover", borderRadius: 6 }}
                  />
                </div>
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
