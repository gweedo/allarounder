import type { MetadataRoute } from "next";
import {
  getArticleCards,
  getCategoryIndex,
  getTagIndex,
  getAuthorIndex,
  getGuestIndex,
} from "../lib/content";

export const dynamic = "force-static";

const BASE = "https://allarounder.it";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    {
      url: `${BASE}/chi-siamo`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${BASE}/cookie-policy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

  // Empty pages are noindex (lib/seo.ts), so only pages with articles are
  // listed. A section root is listed when it has at least one entry.
  const { items: articles } = getArticleCards(1, Number.MAX_SAFE_INTEGER);
  const sections = [
    { path: "argomenti", items: getCategoryIndex(), changeFrequency: "weekly", priority: 0.6 },
    { path: "tag", items: getTagIndex(), changeFrequency: "weekly", priority: 0.5 },
    { path: "autori", items: getAuthorIndex(), changeFrequency: "monthly", priority: 0.5 },
    { path: "ospiti", items: getGuestIndex(), changeFrequency: "monthly", priority: 0.4 },
  ] as const;

  if (articles.length > 0) {
    entries.push({ url: `${BASE}/articoli`, changeFrequency: "daily", priority: 0.7 });
  }
  for (const a of articles) {
    entries.push({
      url: `${BASE}/articoli/${a.slug}`,
      lastModified: new Date(a.updated_at),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  for (const { path, items, changeFrequency, priority } of sections) {
    const nonEmpty = items.filter((item) => item.article_count > 0);
    if (nonEmpty.length > 0) {
      entries.push({ url: `${BASE}/${path}`, changeFrequency, priority });
    }
    for (const item of nonEmpty) {
      entries.push({ url: `${BASE}/${path}/${item.slug}`, changeFrequency, priority });
    }
  }

  return entries;
}
