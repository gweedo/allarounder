import { notFound } from "next/navigation";
import { remark } from "remark";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

export const revalidate = 60;

interface Article {
  id: string;
  title: string;
  slug: string;
  body: string;
  author_id: string;
  publish_at: string;
  spotify_url: string | null;
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

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const bodyHtml = await renderMarkdown(article.body);

  return (
    <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
      <article>
        <h1>{article.title}</h1>
        <time dateTime={article.publish_at}>
          {new Date(article.publish_at).toLocaleDateString("it-IT")}
        </time>
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
