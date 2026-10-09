import type { Metadata } from "next";

// A page with nothing on it yet (an empty category, /ospiti before the first
// guest) stays reachable but out of search results, so Google doesn't index
// thin pages; crawlers may still follow its links. Such pages are also left
// out of the sitemap.
export function emptyPageMetadata(itemCount: number): Pick<Metadata, "robots"> {
  return itemCount === 0 ? { robots: { index: false, follow: true } } : {};
}
