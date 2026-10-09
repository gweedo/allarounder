import Link from "next/link";

interface Entry {
  slug: string;
  name: string;
  article_count: number;
  description?: string | null;
}

interface Props {
  title: string;
  basePath: string;
  items: Entry[];
  emptyText: string;
  namePrefix?: string;
}

function countLabel(count: number): string {
  if (count === 0) return "Ancora nessun articolo";
  return count === 1 ? "1 articolo" : `${count} articoli`;
}

// Shared body of the /argomenti, /autori, /ospiti and /tag section roots.
export function TaxonomyIndex({ title, basePath, items, emptyText, namePrefix = "" }: Props) {
  return (
    <main id="contenuto" className="page-container page-container--wide">
      <header className="page-header">
        <h1>{title}</h1>
      </header>
      {items.length === 0 ? (
        <p>{emptyText}</p>
      ) : (
        <ul className="taxonomy-index">
          {items.map((item) => (
            <li key={item.slug}>
              <h2 className="card-title">
                <Link href={`${basePath}/${item.slug}`}>
                  {namePrefix}
                  {item.name}
                </Link>
              </h2>
              {item.description && <p className="article-excerpt">{item.description}</p>}
              <p className="article-meta">{countLabel(item.article_count)}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
