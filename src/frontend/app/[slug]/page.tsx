import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { remark } from "remark";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

export const revalidate = 300;

interface StaticPage {
  id: string;
  title: string;
  slug: string;
  body: string;
  meta_title: string | null;
  meta_description: string | null;
  updated_at: string;
}

const KNOWN_SLUGS = ["chi-siamo", "contatti", "privacy-policy", "cookie-policy"];

async function getPage(slug: string): Promise<StaticPage | null> {
  const apiUrl = process.env.API_URL ?? "http://backend:8000";
  try {
    const res = await fetch(`${apiUrl}/api/pages/${slug}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as StaticPage;
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

export async function generateStaticParams() {
  return KNOWN_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
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

  const page = await getPage(slug);
  if (!page) notFound();

  const bodyHtml = await renderMarkdown(page.body);

  return (
    <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
      <article>
        <h1>{page.title}</h1>
        <div
          className="page-body"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </article>
    </main>
  );
}
