import Image from "next/image";
import Link from "next/link";
import type { ArticleMeta } from "../../lib/content";
import { formatPublishDate } from "../../lib/dates";

// "grid" is the compact home/related card with a clamped excerpt; "list" is
// the full-width row used by /articoli and the taxonomy pages, which also
// names the author.
export type ArticleCardVariant = "grid" | "list";

interface Props {
  article: ArticleMeta;
  headingLevel: 2 | 3;
  variant: ArticleCardVariant;
}

// The one Article card, used by every list of Articles on the site. The
// caller owns the surrounding <ul>/<li>.
export function ArticleCard({ article, headingLevel, variant }: Props) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  // Nullable in the content contract; 0 would be a meaningless "00 min".
  const minutes = (article.reading_time ?? 0) > 0 ? article.reading_time : null;

  return (
    <div className={`article-card article-card--${variant}`}>
      {article.cover_image_url ? (
        <div className="article-card__thumb">
          <Image
            src={article.cover_image_url}
            alt={article.cover_image_alt ?? `Copertina: ${article.title}`}
            fill
            sizes="6rem"
            style={{ objectFit: "cover" }}
          />
        </div>
      ) : (
        minutes && <ReadingTimeTile minutes={minutes} />
      )}
      <div className="article-card__body">
        {article.category && (
          <Link href={`/argomenti/${article.category.slug}`} className="article-card__category">
            {article.category.name}
          </Link>
        )}
        <Heading className="article-card__title">
          <Link href={`/articoli/${article.slug}`}>{article.title}</Link>
        </Heading>
        {article.excerpt && <p className="article-card__excerpt">{article.excerpt}</p>}
        <p className="article-meta article-card__meta">
          <time dateTime={article.publish_at}>{formatPublishDate(article.publish_at)}</time>
          {variant === "list" && article.author_profile && (
            <span>di {article.author_profile.name}</span>
          )}
          {minutes && <span>{minutes} min di lettura</span>}
        </p>
      </div>
    </div>
  );
}

// The scoreboard tile stands in for a missing Cover image. Its zero-padded
// digits are decoration; assistive technology hears the sentence instead.
function ReadingTimeTile({ minutes }: { minutes: number }) {
  return (
    <div className="article-card__tile">
      <span aria-hidden="true" className="article-card__tile-value">
        {String(minutes).padStart(2, "0")}
      </span>
      <span aria-hidden="true" className="article-card__tile-unit">
        min
      </span>
      <span className="visually-hidden">
        {minutes} {minutes === 1 ? "minuto" : "minuti"} di lettura
      </span>
    </div>
  );
}
