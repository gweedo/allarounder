import { describe, it, expect, vi } from "vitest";

const ref = (slug: string, name = slug) => ({ id: `id-${slug}`, name, slug });

const INDEX = {
  articles: [
    {
      slug: "a1",
      publish_at: "2026-10-01T00:00:00Z",
      category: ref("analisi", "Analisi"),
      author_profile: ref("zeta", "Zeta"),
      tags: [ref("nba", "NBA"), ref("ansia")],
      guests: [ref("ospite", "Ospite")],
    },
    {
      slug: "a2",
      publish_at: "2026-10-02T00:00:00Z",
      category: ref("analisi", "Analisi"),
      author_profile: ref("alfa", "Alfa"),
      tags: [ref("nba", "NBA")],
      guests: [],
    },
  ],
  categories: [
    { ...ref("interviste", "Interviste"), description: null },
    { ...ref("analisi", "Analisi"), description: "Approfondimenti." },
  ],
  authors: [
    { ...ref("zeta", "Zeta"), bio: null, photo_url: null, links: {} },
    { ...ref("alfa", "Alfa"), bio: null, photo_url: null, links: {} },
  ],
  guests: [{ ...ref("ospite", "Ospite"), bio: null, photo_url: null, links: {} }],
  tags: [ref("nba", "NBA"), ref("ansia")],
};

vi.mock("fs", () => ({
  default: { readFileSync: () => JSON.stringify(INDEX), existsSync: () => false },
}));

const content = await import("../content");

describe("section index loaders", () => {
  it("lists categories in index order with their article counts, empty ones included", () => {
    expect(content.getCategoryIndex().map((c) => [c.slug, c.article_count])).toEqual([
      ["interviste", 0],
      ["analisi", 2],
    ]);
    expect(content.getCategoryIndex()[1].description).toBe("Approfondimenti.");
  });

  it("lists authors alphabetically with their article counts", () => {
    expect(content.getAuthorIndex().map((a) => [a.slug, a.article_count])).toEqual([
      ["alfa", 1],
      ["zeta", 1],
    ]);
  });

  it("lists guests with their article counts", () => {
    expect(content.getGuestIndex().map((g) => [g.slug, g.article_count])).toEqual([["ospite", 1]]);
  });

  it("lists tags alphabetically, ignoring case, with their article counts", () => {
    expect(content.getTagIndex().map((t) => [t.name, t.article_count])).toEqual([
      ["ansia", 1],
      ["NBA", 2],
    ]);
  });
});
