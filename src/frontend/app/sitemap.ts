import type { MetadataRoute } from "next";
import {
  getArticleCards,
  getAllCategorySlugsForSitemap,
  getAllTagSlugs,
  getAllAuthorSlugs,
  getAllGuestSlugs,
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
      url: `${BASE}/contatti`,
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

  // Articles
  const { items: articles } = getArticleCards(1, Number.MAX_SAFE_INTEGER);
  for (const a of articles) {
    entries.push({
      url: `${BASE}/articoli/${a.slug}`,
      lastModified: new Date(a.updated_at),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // Categories
  for (const c of getAllCategorySlugsForSitemap()) {
    entries.push({
      url: `${BASE}/argomenti/${c.slug}`,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  // Tags
  for (const slug of getAllTagSlugs()) {
    entries.push({
      url: `${BASE}/tag/${slug}`,
      changeFrequency: "weekly",
      priority: 0.5,
    });
  }

  // Authors
  for (const slug of getAllAuthorSlugs()) {
    entries.push({
      url: `${BASE}/autori/${slug}`,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  // Guests
  for (const slug of getAllGuestSlugs()) {
    entries.push({
      url: `${BASE}/ospiti/${slug}`,
      changeFrequency: "monthly",
      priority: 0.4,
    });
  }

  return entries;
}
