import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { renderMarkdown } from "../../lib/markdown";
import { getStaticPageBySlug } from "../../lib/content";

const KNOWN_SLUGS = ["chi-siamo", "contatti", "privacy-policy", "cookie-policy"];

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return KNOWN_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getStaticPageBySlug(slug);
  if (!page) return {};

  const title = page.meta_title ?? `${page.title} — Allarounder`;
  const description = page.meta_description ?? undefined;
  const url = `https://allarounder.it/${page.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
  };
}

export default async function StaticPageRoute({ params }: Props) {
  const { slug } = await params;
  if (!KNOWN_SLUGS.includes(slug)) notFound();

  const page = getStaticPageBySlug(slug);
  if (!page) notFound();

  const bodyHtml = await renderMarkdown(page.body);

  return (
    <main className="page-container">
      <article>
        <h1>{page.title}</h1>
        <div
          className="page-body article-body"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </article>
    </main>
  );
}
