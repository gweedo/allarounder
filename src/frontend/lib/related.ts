// "Leggi anche" ranking for the end of an article page.
//
// Pure so it can be unit-tested without the filesystem; lib/content.ts feeds
// it every published article, newest first.
import type { ArticleMeta } from "./content";

// A shared category counts for more than any single shared tag.
const CATEGORY_WEIGHT = 2;

function score(current: ArticleMeta, candidate: ArticleMeta): number {
  const sameCategory =
    current.category !== null && candidate.category?.slug === current.category.slug;
  const currentTags = new Set(current.tags.map((t) => t.slug));
  const sharedTags = candidate.tags.filter((t) => currentTags.has(t.slug)).length;
  return (sameCategory ? CATEGORY_WEIGHT : 0) + sharedTags;
}

// Unrelated articles still fill the list (score 0, newest first), so the page
// never ends without somewhere to go next.
export function rankRelated(
  current: ArticleMeta,
  candidates: ArticleMeta[],
  limit: number,
): ArticleMeta[] {
  return candidates
    .filter((a) => a.slug !== current.slug)
    .map((a) => ({ a, s: score(current, a) }))
    .sort((x, y) => y.s - x.s) // Array.prototype.sort is stable: ties keep input order
    .slice(0, limit)
    .map(({ a }) => a);
}
