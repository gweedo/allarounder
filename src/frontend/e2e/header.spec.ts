import { test, expect } from "@playwright/test";

// Header bar, design B · Tabellone (#155): two rows on a phone with no
// horizontal scroll, one row in order at the 800px desktop breakpoint, a
// full-width brand bar at 1280px and wider, and a visible focus ring on every
// header link.

test.describe("Header bar on a 390px phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("fits in two rows with every link visible, tappable and no page overflow", async ({
    page,
  }) => {
    await page.goto("/");
    const links = page.getByRole("banner").getByRole("link");
    expect(await links.count()).toBeGreaterThanOrEqual(4);

    const tops: number[] = [];
    for (const link of await links.all()) {
      await expect(link).toBeInViewport({ ratio: 1 });
      const box = await link.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      tops.push(Math.round(box!.y));
    }
    const rows = tops.filter(
      (top, i) => tops.findIndex((t) => Math.abs(t - top) <= 4) === i,
    );
    expect(rows.length).toBeLessThanOrEqual(2);

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("Header bar on desktop", () => {
  for (const width of [1280, 1920]) {
    test(`the brand bar spans the full viewport width at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const banner = page.getByRole("banner");
      const box = await banner.boundingBox();
      expect(box!.x).toBe(0);
      expect(box!.width).toBe(width);
      await expect(banner).not.toHaveCSS(
        "background-color",
        "rgba(0, 0, 0, 0)",
      );
    });
  }
});

test.describe("Header bar at the 800px desktop breakpoint", () => {
  test.use({ viewport: { width: 800, height: 768 } });

  test("lays out wordmark, nav and CTA on one row, in order, with no page overflow", async ({
    page,
  }) => {
    await page.goto("/");
    const links = await page.getByRole("banner").getByRole("link").all();
    const boxes = [];
    for (const link of links) {
      await expect(link).toBeInViewport({ ratio: 1 });
      boxes.push((await link.boundingBox())!);
    }
    // The pill is vertically centred on the row, so allow a few px of drift.
    const tops = boxes.map((b) => Math.round(b.y));
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(4);
    // Wordmark, Articoli, Argomenti, Chi siamo, CTA: left to right, no overlap.
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].width);
    }
    // The CTA ends the row and shows its long label: on phones " il podcast"
    // is still in the text, but visually hidden in a 1px box.
    const cta = links.at(-1)!;
    await expect(cta).toHaveAccessibleName("Ascolta il podcast");
    const longLabel = await cta.getByText("il podcast").boundingBox();
    expect(longLabel!.width).toBeGreaterThan(1);

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("Header keyboard focus", () => {
  test("every header link shows a focus ring when reached with the keyboard", async ({
    page,
  }) => {
    await page.goto("/chi-siamo");
    const banner = page.getByRole("banner");
    // Inside the bar the ring takes the on-brand text colour, whatever the
    // brand tokens are, so it stays visible against --color-brand.
    const onBrand = await banner.evaluate((el) => getComputedStyle(el).color);
    const count = await banner.getByRole("link").count();

    await page.keyboard.press("Tab"); // skip link
    await expect(
      page.getByRole("link", { name: "Vai al contenuto" }),
    ).not.toHaveCSS("outline-style", "none");
    for (let i = 0; i < count; i++) {
      await page.keyboard.press("Tab");
      const focused = page.locator(":focus");
      await expect(banner.locator(":focus")).toHaveCount(1);
      await expect(focused).not.toHaveCSS("outline-style", "none");
      await expect(focused).toHaveCSS("outline-color", onBrand);
    }
  });
});
