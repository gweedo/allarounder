import { describe, it, expect } from "vitest";
import { EMPTY_COLLECTION_SLUG, slugParams } from "../static-params";

describe("slugParams", () => {
  it("maps each slug to a route param", () => {
    expect(slugParams(["primo", "secondo"])).toEqual([{ slug: "primo" }, { slug: "secondo" }]);
  });

  it("returns a single placeholder param for an empty collection", () => {
    // `output: "export"` fails the whole build when a dynamic route's
    // generateStaticParams() returns [] -- e.g. no guests published yet.
    expect(slugParams([])).toEqual([{ slug: EMPTY_COLLECTION_SLUG }]);
  });
});

describe("EMPTY_COLLECTION_SLUG", () => {
  it("can never collide with a real slug", () => {
    // Real slugs (Slug.from_title in the pipeline) are [a-z0-9-] only.
    expect(EMPTY_COLLECTION_SLUG).not.toMatch(/^[a-z0-9-]+$/);
  });
});
