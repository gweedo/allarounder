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
    <main className="page-container page-container--wide">
      <header className="profile-header">
        {data.photo_url && (
          <Image
            src={data.photo_url}
            alt={`Foto di ${data.name}`}
            width={120}
            height={120}
            className="profile-photo"
          />
        )}
        <div>
          <h1 style={{ marginBottom: "0.5rem" }}>{data.name}</h1>
          {data.bio && <p className="profile-bio">{data.bio}</p>}
          {Object.entries(data.links).length > 0 && (
            <div className="profile-links">
              {Object.entries(data.links).map(([label, url]) => (
                <a key={label} href={url} target="_blank" rel="noopener noreferrer">
                  {label}
                </a>
              ))}
            </div>
          )}
        </div>
      </header>
      <p className="page-count" style={{ marginBottom: "1.5rem" }}>
        {data.total} {data.total === 1 ? "articolo pubblicato" : "articoli pubblicati"}
      </p>
      {data.articles.length === 0 ? (
        <p>Nessun articolo pubblicato con questo ospite.</p>
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
