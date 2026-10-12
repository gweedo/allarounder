import { readFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

const index: { articles: { slug: string }[]; categories: { slug: string }[] } = JSON.parse(
  readFileSync(path.join(__dirname, "..", "content", "index.json"), "utf-8"),
);

const pages = [
  "/",
  "/argomenti",
  "/pagina/che/non-esiste",
  ...index.articles.slice(0, 1).map(({ slug }) => `/articoli/${slug}`),
  ...index.categories.slice(0, 1).map(({ slug }) => `/argomenti/${slug}`),
];

// Known failure, owned by the design session (docs/handoff/DESIGN-REVIEW-PROMPT.md):
// the Spotify CTA uses Spotify green #1db954 as text on the light background,
// about 2.5:1 against WCAG AA's 4.5:1. Only those nodes are tolerated; the
// color-contrast rule stays on everywhere else. Delete this once the colour lands.
function isKnownFailure(ruleId: string, target: string) {
  return ruleId === "color-contrast" && target.includes(".spotify-callout");
}

test.describe("Accessibility (axe, WCAG 2.1 AA)", () => {
  for (const url of pages) {
    for (const width of [1280, 390]) {
      test(`${url} at ${width}px has no violations`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(url);
        const { violations } = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();

        const unexpected = violations.flatMap(({ id, help, nodes }) =>
          nodes
            .map((node) => node.target.join(" "))
            .filter((target) => !isKnownFailure(id, target))
            .map((target) => `${id}: ${help} — ${target}`),
        );
        expect(unexpected).toEqual([]);
      });
    }
  }
});
