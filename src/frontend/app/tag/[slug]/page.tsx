import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTagBySlug, getAllTagSlugs } from "../../../lib/content";
import { ArticleList } from "../../_components/ArticleList";
import { slugParams } from "../../../lib/static-params";

export async function generateStaticParams() {
  return slugParams(getAllTagSlugs());
}

function getTagData(slug: string) {
  const result = getTagBySlug(slug);
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
  const data = getTagData(slug);
  if (!data) return {};
  return {
    title: { absolute: `#${data.name} — Allarounder` },
    description: `Articoli con il tag "${data.name}"`,
    alternates: { canonical: `https://allarounder.it/tag/${data.slug}` },
  };
}

export default async function TagPage({ params }: Props) {
  const { slug } = await params;
  const data = getTagData(slug);
  if (!data) notFound();

  return (
    <main id="contenuto" className="page-container page-container--wide">
      <header className="page-header">
        <h1>#{data.name}</h1>
        <p className="page-count">
          {data.total} {data.total === 1 ? "articolo" : "articoli"}
        </p>
      </header>
      {data.articles.length === 0 ? (
        <p>Nessun articolo pubblicato con questo tag.</p>
      ) : (
        <ArticleList articles={data.articles} />
      )}
    </main>
  );
}
