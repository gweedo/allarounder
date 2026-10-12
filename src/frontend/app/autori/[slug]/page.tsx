import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getAuthorBySlug, getAllAuthorSlugs } from "../../../lib/content";
import { ArticleList } from "../../_components/ArticleList";
import { slugParams } from "../../../lib/static-params";

export async function generateStaticParams() {
  return slugParams(getAllAuthorSlugs());
}

function getAuthorData(slug: string) {
  const result = getAuthorBySlug(slug);
  if (!result) return null;
  return {
    ...result.detail,
    articles: result.articles,
    total: result.articles.length,
    page: 1,
    page_size: result.articles.length,
  };
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = getAuthorData(slug);
  if (!data) return {};
  return {
    title: { absolute: `${data.name} — Allarounder` },
    description: data.bio ?? `Articoli di ${data.name} su Allarounder`,
    alternates: { canonical: `https://allarounder.it/autori/${data.slug}` },
  };
}

export default async function AuthorPage({ params }: Props) {
  const { slug } = await params;
  const data = getAuthorData(slug);
  if (!data) notFound();

  return (
    <main id="contenuto" className="page-container page-container--wide">
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
          <h1 className="profile-name">{data.name}</h1>
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
      <p className="page-count profile-count">
        {data.total} {data.total === 1 ? "articolo pubblicato" : "articoli pubblicati"}
      </p>
      {data.articles.length === 0 ? (
        <p>Nessun articolo pubblicato da questo autore.</p>
      ) : (
        <ArticleList articles={data.articles} />
      )}
    </main>
  );
}
