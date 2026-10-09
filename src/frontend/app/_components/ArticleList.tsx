import Image from "next/image";
import Link from "next/link";
import type { ArticleMeta } from "../../lib/content";
import { formatPublishDate } from "../../lib/dates";

// Vertical article list used by the /articoli section root.
export function ArticleList({ articles }: { articles: ArticleMeta[] }) {
  return (
    <ul className="article-list">
      {articles.map((article) => (
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
          {article.category && (
            <Link href={`/argomenti/${article.category.slug}`} className="category-badge category-badge--muted">
              {article.category.name}
            </Link>
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
            <time dateTime={article.publish_at}>{formatPublishDate(article.publish_at)}</time>
            {article.author_profile && (
              <span style={{ marginLeft: "1rem" }}>di {article.author_profile.name}</span>
            )}
            {article.reading_time && (
              <span style={{ marginLeft: "1rem" }}>{article.reading_time} min di lettura</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
