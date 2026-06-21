import Image from "next/image";
import { notFound } from "next/navigation";
import { remark } from "remark";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

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
}

async function getPreviewArticle(token: string): Promise<Article | null> {
  const apiUrl = process.env.API_URL ?? "http://backend:8000";
  try {
    const res = await fetch(`${apiUrl}/api/preview/articles/${token}`, {
      cache: "no-store",
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
  params: Promise<{ token: string }>;
}

export default async function PreviewArticlePage({ params }: Props) {
  const { token } = await params;
  const article = await getPreviewArticle(token);
  if (!article) notFound();

  const bodyHtml = await renderMarkdown(article.body);

  return (
    <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
      <div
        role="banner"
        aria-label="anteprima"
        style={{
          background: "#fef3c7",
          border: "1px solid #f59e0b",
          borderRadius: "8px",
          padding: "0.75rem 1rem",
          marginBottom: "1.5rem",
          fontWeight: 600,
          color: "#92400e",
        }}
      >
        ANTEPRIMA — non pubblicato
      </div>
      <article>
        {article.cover_image_url && (
          <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", marginBottom: "1.5rem" }}>
            <Image
              src={article.cover_image_url}
              alt={article.cover_image_alt ?? `Copertina articolo: ${article.title}`}
              fill
              style={{ objectFit: "cover", borderRadius: "8px" }}
            />
          </div>
        )}
        <h1>{article.title}</h1>
        <time dateTime={article.publish_at}>
          {new Date(article.publish_at).toLocaleDateString("it-IT")}
        </time>
        {article.reading_time && (
          <span style={{ marginLeft: "1rem", color: "#666" }}>
            {article.reading_time} min di lettura
          </span>
        )}
        {article.excerpt && (
          <p style={{ fontStyle: "italic", marginTop: "1rem", color: "#555" }}>
            {article.excerpt}
          </p>
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
