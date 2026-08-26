// Filesystem-backed content loader, replacing the retired FastAPI read API.
//
// Reads content/index.json (article metadata + taxonomy detail) and
// content/articles/<slug>.md / content/pages/<slug>.md (frontmatter + Markdown
// body) at build time. The Task 3 CI pipeline generates these files from the
// editorial Google Sheet/Docs — this loader defines the contract it must emit.
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const CONTENT_DIR = path.join(process.cwd(), "content");

export interface SlugRef {
  id: string;
  name: string;
  slug: string;
}

export interface ArticleMeta {
  id: string;
  title: string;
  slug: string;
  author_id: string;
  publish_at: string;
  updated_at: string;
  spotify_url: string | null;
  excerpt: string | null;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  reading_time: number | null;
  author_profile: SlugRef | null;
  category: SlugRef | null;
  tags: SlugRef[];
  guests: SlugRef[];
}

export interface Article extends ArticleMeta {
  body: string;
}

export interface CategoryDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface ProfileDetail {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  photo_url: string | null;
  links: Record<string, string>;
}

interface ContentIndex {
  articles: ArticleMeta[];
  categories: CategoryDetail[];
  authors: ProfileDetail[];
  guests: ProfileDetail[];
  tags: SlugRef[];
}

let indexCache: ContentIndex | null = null;

function readIndex(): ContentIndex {
  if (!indexCache) {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, "index.json"), "utf-8");
    indexCache = JSON.parse(raw) as ContentIndex;
  }
  return indexCache;
}

function sortedArticles(): ArticleMeta[] {
  return [...readIndex().articles].sort(
    (a, b) => new Date(b.publish_at).getTime() - new Date(a.publish_at).getTime(),
  );
}

export interface ArticleListResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export function getArticleCards(page: number, pageSize: number): ArticleListResult<ArticleMeta> {
  const all = sortedArticles();
  const start = (page - 1) * pageSize;
  return {
    items: all.slice(start, start + pageSize),
    total: all.length,
    page,
    page_size: pageSize,
  };
}

export function getAllArticleSlugs(): string[] {
  return readIndex().articles.map((a) => a.slug);
}

export function getArticleBySlug(slug: string): Article | null {
  const filePath = path.join(CONTENT_DIR, "articles", `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  return { ...(data as ArticleMeta), body: content.trim() };
}

interface TaxonomyWithArticles<T> {
  detail: T;
  articles: ArticleMeta[];
}

export function getAllCategorySlugs(): string[] {
  return readIndex().categories.map((c) => c.slug);
}

export function getCategoryBySlug(slug: string): TaxonomyWithArticles<CategoryDetail> | null {
  const detail = readIndex().categories.find((c) => c.slug === slug);
  if (!detail) return null;
  const articles = sortedArticles().filter((a) => a.category?.slug === slug);
  return { detail, articles };
}

export function getAllAuthorSlugs(): string[] {
  return readIndex().authors.map((a) => a.slug);
}

export function getAuthorBySlug(slug: string): TaxonomyWithArticles<ProfileDetail> | null {
  const detail = readIndex().authors.find((a) => a.slug === slug);
  if (!detail) return null;
  const articles = sortedArticles().filter((a) => a.author_profile?.slug === slug);
  return { detail, articles };
}

export function getAllGuestSlugs(): string[] {
  return readIndex().guests.map((g) => g.slug);
}

export function getGuestBySlug(slug: string): TaxonomyWithArticles<ProfileDetail> | null {
  const detail = readIndex().guests.find((g) => g.slug === slug);
  if (!detail) return null;
  const articles = sortedArticles().filter((a) => a.guests.some((g) => g.slug === slug));
  return { detail, articles };
}

export function getAllTagSlugs(): string[] {
  return readIndex().tags.map((t) => t.slug);
}

export function getTagBySlug(slug: string): TaxonomyWithArticles<SlugRef> | null {
  const detail = readIndex().tags.find((t) => t.slug === slug);
  if (!detail) return null;
  const articles = sortedArticles().filter((a) => a.tags.some((t) => t.slug === slug));
  return { detail, articles };
}

export function getAllCategorySlugsForSitemap(): SlugRef[] {
  return readIndex().categories;
}

export interface StaticPage {
  id: string;
  title: string;
  slug: string;
  meta_title: string | null;
  meta_description: string | null;
  updated_at: string;
  body: string;
}

export function getStaticPageBySlug(slug: string): StaticPage | null {
  const filePath = path.join(CONTENT_DIR, "pages", `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  return { ...(data as Omit<StaticPage, "body">), body: content.trim() };
}
