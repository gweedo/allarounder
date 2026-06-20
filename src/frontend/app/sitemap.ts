import type { MetadataRoute } from "next";

const BASE = "https://allarounder.it";
const API = process.env.API_URL ?? "http://backend:8000";

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface ArticleItem {
  slug: string;
  updated_at: string;
  publish_at: string;
}
interface ArticleListResponse {
  items: ArticleItem[];
  total: number;
  page: number;
  page_size: number;
}
interface SlugItem {
  slug: string;
}
interface ListResponse<T> {
  items: T[];
}

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

  // Articles — paginate through all pages
  let page = 1;
  const pageSize = 100;
  while (true) {
    const data = await fetchJson<ArticleListResponse>(
      `/api/articles?page=${page}&page_size=${pageSize}`,
    );
    if (!data || data.items.length === 0) break;
    for (const a of data.items) {
      entries.push({
        url: `${BASE}/articoli/${a.slug}`,
        lastModified: new Date(a.updated_at),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
    if (data.items.length < pageSize) break;
    page++;
  }

  // Categories
  const cats = await fetchJson<ListResponse<SlugItem>>("/api/categories");
  if (cats) {
    for (const c of cats.items) {
      entries.push({
        url: `${BASE}/argomenti/${c.slug}`,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }

  // Tags
  const tags = await fetchJson<ListResponse<SlugItem>>("/api/tags");
  if (tags) {
    for (const t of tags.items) {
      entries.push({
        url: `${BASE}/tag/${t.slug}`,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  // Authors
  const authors = await fetchJson<ListResponse<SlugItem>>("/api/authors");
  if (authors) {
    for (const a of authors.items) {
      entries.push({
        url: `${BASE}/autori/${a.slug}`,
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  }

  // Guests
  const guests = await fetchJson<ListResponse<SlugItem>>("/api/guests");
  if (guests) {
    for (const g of guests.items) {
      entries.push({
        url: `${BASE}/ospiti/${g.slug}`,
        changeFrequency: "monthly",
        priority: 0.4,
      });
    }
  }

  return entries;
}
