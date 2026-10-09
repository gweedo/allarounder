// generateStaticParams() helper for the dynamic content routes.
//
// Under `output: "export"`, Next.js fails the whole build when a dynamic
// route's generateStaticParams() returns an empty array ("missing
// generateStaticParams()"). Collections are legitimately empty -- no guests
// or tags published yet, or no articles at all before launch -- so an empty
// collection yields one placeholder param instead. Each page already calls
// notFound() for a slug it can't resolve, so the placeholder exports as a
// not-found page and nothing links to it.

// Contains "_", which Slug.from_title never produces ([a-z0-9-] only), so it
// can never shadow a real page.
export const EMPTY_COLLECTION_SLUG = "_vuoto";

export function slugParams(slugs: string[]): { slug: string }[] {
  if (slugs.length === 0) return [{ slug: EMPTY_COLLECTION_SLUG }];
  return slugs.map((slug) => ({ slug }));
}
