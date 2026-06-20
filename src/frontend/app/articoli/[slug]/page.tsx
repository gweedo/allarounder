import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { remark } from "remark";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

export const revalidate = 60;

interface AuthorRef {
  id: string;
  name: string;
  slug: string;
}

interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}

interface TagRef {
  id: string;
  name: string;
  slug: string;
}

interface GuestRef {
  id: string;
  name: string;
  slug: string;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  body: string;
  author_id: string;
  publish_at: string;
  spotify_url: string | null;
  excerpt: string | null;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  reading_time: number | null;
  author_profile: AuthorRef | null;
  category: CategoryRef | null;
  tags: TagRef[];
  guests: GuestRef[];
}

async function getArticle(slug: string): Promise<Article | null> {
  const apiUrl = process.env.API_URL ?? "http://backend:8000";
  try {
    const res = await fetch(`${apiUrl}/api/articles/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as Article;
  } catch {
    return null;
  }
}

async function renderMarkdown(markdown: string): Promise<string> {
  const file = await remark()
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return {};

  const title = article.meta_title ?? `${article.title} — Allarounder`;
  const description = article.meta_description ?? article.excerpt ?? undefined;
  const ogImage = article.og_image_url ?? article.cover_image_url ?? undefined;
  const url = `https://allarounder.it/articoli/${article.slug}`;

  return {
    title,
    description,
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
  const article = await getArticle(slug);
  if (!article) notFound();

  const bodyHtml = await renderMarkdown(article.body);

  return (
    <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
      <article>
        {article.cover_image_url && (
          <img
            src={article.cover_image_url}
            alt={article.cover_image_alt ?? `Copertina articolo: ${article.title}`}
            style={{ width: "100%", borderRadius: "8px", marginBottom: "1.5rem" }}
          />
        )}
        <h1>{article.title}</h1>
        <div style={{ color: "#666", marginTop: "0.25rem" }}>
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
              <a
                href={`/autori/${article.author_profile.slug}`}
                style={{ color: "#444", textDecoration: "underline" }}
              >
                {article.author_profile.name}
              </a>
            </span>
          )}
        </div>
        {article.category && (
          <p style={{ marginTop: "0.5rem" }}>
            <a
              href={`/argomenti/${article.category.slug}`}
              style={{ color: "#555", textDecoration: "underline", fontSize: "0.9rem" }}
            >
              {article.category.name}
            </a>
          </p>
        )}
        {article.excerpt && (
          <p style={{ fontStyle: "italic", marginTop: "1rem", color: "#555" }}>
            {article.excerpt}
          </p>
        )}
        {article.tags && article.tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1rem" }}>
            {article.tags.map((tag) => (
              <a
                key={tag.id}
                href={`/tag/${tag.slug}`}
                style={{
                  display: "inline-block",
                  padding: "0.2rem 0.6rem",
                  background: "#f0f0f0",
                  borderRadius: "4px",
                  fontSize: "0.8rem",
                  color: "#444",
                  textDecoration: "none",
                }}
              >
                #{tag.name}
              </a>
            ))}
          </div>
        )}
        {article.guests && article.guests.length > 0 && (
          <div style={{ marginTop: "1rem", fontSize: "0.9rem", color: "#555" }}>
            <span>Ospiti: </span>
            {article.guests.map((guest, i) => (
              <span key={guest.id}>
                <a
                  href={`/ospiti/${guest.slug}`}
                  style={{ color: "#444", textDecoration: "underline" }}
                >
                  {guest.name}
                </a>
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
          <div
            style={{
              marginTop: "2rem",
              padding: "1rem",
              border: "1px solid #1db954",
              borderRadius: "8px",
            }}
          >
            <a
              href={article.spotify_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#1db954", textDecoration: "none" }}
            >
              Ascolta su Spotify
            </a>
          </div>
        )}
      </article>
    </main>
  );
}
