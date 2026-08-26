import Image from "next/image";
import { notFound } from "next/navigation";
import { renderMarkdown } from "../../../../lib/markdown";

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

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PreviewArticlePage({ params }: Props) {
  const { token } = await params;
  const article = await getPreviewArticle(token);
  if (!article) notFound();

  const bodyHtml = await renderMarkdown(article.body);

  return (
    <main className="page-container">
      <div role="banner" aria-label="anteprima" className="page-banner">
        ANTEPRIMA — non pubblicato
      </div>
      <article>
        {article.cover_image_url && (
          <div className="cover-image" style={{ aspectRatio: "16/9", marginBottom: "1.5rem" }}>
            <Image
              src={article.cover_image_url}
              alt={article.cover_image_alt ?? `Copertina articolo: ${article.title}`}
              fill
              style={{ objectFit: "cover" }}
            />
          </div>
        )}
        <h1>{article.title}</h1>
        <time dateTime={article.publish_at}>
          {new Date(article.publish_at).toLocaleDateString("it-IT")}
        </time>
        {article.reading_time && (
          <span className="article-meta" style={{ marginLeft: "1rem" }}>
            {article.reading_time} min di lettura
          </span>
        )}
        {article.excerpt && (
          <p className="article-excerpt" style={{ fontStyle: "italic", marginTop: "1rem" }}>
            {article.excerpt}
          </p>
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
