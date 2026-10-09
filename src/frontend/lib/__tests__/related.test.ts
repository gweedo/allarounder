import { describe, it, expect } from "vitest";
import type { ArticleMeta, SlugRef } from "../content";
import { rankRelated } from "../related";

const ref = (slug: string): SlugRef => ({ id: slug, name: slug, slug });

function article(slug: string, opts: { category?: string; tags?: string[] } = {}): ArticleMeta {
  return {
    slug,
    category: opts.category ? ref(opts.category) : null,
    tags: (opts.tags ?? []).map(ref),
  } as ArticleMeta;
}

const slugs = (list: ArticleMeta[]) => list.map((a) => a.slug);

describe("rankRelated", () => {
  it("never suggests the article itself", () => {
    const current = article("a", { category: "analisi" });
    expect(slugs(rankRelated(current, [current, article("b")], 3))).toEqual(["b"]);
  });

  it("ranks the same category above unrelated articles", () => {
    const current = article("a", { category: "analisi" });
    const candidates = [article("other"), article("same", { category: "analisi" })];
    expect(slugs(rankRelated(current, candidates, 3))).toEqual(["same", "other"]);
  });

  it("ranks more shared tags higher", () => {
    const current = article("a", { tags: ["x", "y"] });
    const candidates = [article("one", { tags: ["x"] }), article("two", { tags: ["x", "y"] })];
    expect(slugs(rankRelated(current, candidates, 3))).toEqual(["two", "one"]);
  });

  it("weighs the category above a single shared tag", () => {
    const current = article("a", { category: "analisi", tags: ["x"] });
    const candidates = [article("tag", { tags: ["x"] }), article("cat", { category: "analisi" })];
    expect(slugs(rankRelated(current, candidates, 3))).toEqual(["cat", "tag"]);
  });

  it("keeps the incoming (newest-first) order among equal scores", () => {
    const current = article("a");
    const candidates = [article("newer"), article("older")];
    expect(slugs(rankRelated(current, candidates, 3))).toEqual(["newer", "older"]);
  });

  it("returns at most `limit` articles", () => {
    const current = article("a");
    const candidates = ["b", "c", "d", "e"].map((s) => article(s));
    expect(rankRelated(current, candidates, 3)).toHaveLength(3);
  });
});
