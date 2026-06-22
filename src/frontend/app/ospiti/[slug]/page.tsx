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

interface GuestWithArticles {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  photo_url: string | null;
  links: Record<string, string>;
  articles: Article[];
  total: number;
  page: number;
  page_size: number;
}

async function getGuestData(slug: string): Promise<GuestWithArticles | null> {
  const apiUrl = process.env.API_URL ?? "http://backend:8000";
  try {
    const res = await fetch(`${apiUrl}/api/guests/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as GuestWithArticles;
  } catch {
    return null;
  }
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getGuestData(slug);
  if (!data) return {};
  return {
    title: `${data.name} — Allarounder`,
    description: data.bio ?? `Articoli con ${data.name} su Allarounder`,
    alternates: { canonical: `https://allarounder.it/ospiti/${data.slug}` },
  };
}

export default async function GuestPage({ params }: Props) {
  const { slug } = await params;
  const data = await getGuestData(slug);
  if (!data) notFound();

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
      <header style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", marginBottom: "2rem" }}>
        {data.photo_url && (
          <Image
            src={data.photo_url}
            alt={`Foto di ${data.name}`}
            width={120}
            height={120}
            style={{ borderRadius: "50%", objectFit: "cover" }}
          />
        )}
        <div>
          <h1 style={{ marginBottom: "0.5rem" }}>{data.name}</h1>
          {data.bio && <p style={{ color: "#555" }}>{data.bio}</p>}
          {Object.entries(data.links).length > 0 && (
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
              {Object.entries(data.links).map(([label, url]) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#1a73e8", textDecoration: "none", fontSize: "0.9rem" }}
                >
                  {label}
                </a>
              ))}
            </div>
          )}
        </div>
      </header>
      <p style={{ color: "#888", marginBottom: "1.5rem" }}>
        {data.total} {data.total === 1 ? "articolo pubblicato" : "articoli pubblicati"}
      </p>
      {data.articles.length === 0 ? (
        <p>Nessun articolo pubblicato con questo ospite.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "1.5rem" }}>
          {data.articles.map((article) => (
            <li
              key={article.id}
              style={{ borderBottom: "1px solid #eee", paddingBottom: "1.5rem" }}
            >
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
