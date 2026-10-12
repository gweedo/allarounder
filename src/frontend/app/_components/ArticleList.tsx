import type { ArticleMeta } from "../../lib/content";
import { ArticleCard } from "./ArticleCard";

// Vertical list of Article cards: /articoli and the Category, Tag, Author
// and Guest pages.
export function ArticleList({ articles }: { articles: ArticleMeta[] }) {
  return (
    <ul className="article-list">
      {articles.map((article) => (
        <li key={article.id}>
          <ArticleCard article={article} headingLevel={2} variant="list" />
        </li>
      ))}
    </ul>
  );
}
