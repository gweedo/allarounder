import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { renderMarkdown } from "../../lib/markdown";
import { getStaticPageBySlug } from "../../lib/content";

// "contatti" is suspended until the page has a real contact channel; its
// Markdown stays in content/pages/ so it can come back by re-adding the slug
// here, to the footer (app/layout.tsx) and to the sitemap.
const KNOWN_SLUGS = ["chi-siamo", "privacy-policy", "cookie-policy"];

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
    // Absolute: `title` already ends in "— Allarounder"; the root layout's
    // "%s — Allarounder" template would otherwise append it a second time.
    title: { absolute: title },
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
    <main id="contenuto" className="page-container">
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
