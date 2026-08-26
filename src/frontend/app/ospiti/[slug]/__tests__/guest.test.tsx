import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const getGuestBySlug = vi.fn();
vi.mock("../../../../lib/content", () => ({
  getGuestBySlug: (slug: string) => getGuestBySlug(slug),
  getAllGuestSlugs: () => [],
}));

const BASE_DETAIL = {
  id: "g1",
  name: "Mario Bianchi",
  slug: "mario-bianchi",
  bio: "Ospite del podcast." as string | null,
  photo_url: null as string | null,
  links: {} as Record<string, string>,
};

async function renderGuestPage(
  data: { detail: typeof BASE_DETAIL; articles: Record<string, unknown>[] } | null,
) {
  const GuestPage = (await import("../page")).default;
  getGuestBySlug.mockReturnValueOnce(data);

  try {
    render(
      await GuestPage({
        params: Promise.resolve({ slug: data?.detail.slug ?? "missing" }),
      }),
    );
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_NOT_FOUND") return "notFound";
    throw e;
  }
  return "rendered";
}

describe("GuestPage", () => {
  it("renders guest name as heading", async () => {
    await renderGuestPage({ detail: BASE_DETAIL, articles: [] });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Mario Bianchi");
  });

  it("renders guest bio", async () => {
    await renderGuestPage({ detail: BASE_DETAIL, articles: [] });
    expect(screen.getByText("Ospite del podcast.")).toBeInTheDocument();
  });

  it("renders photo when photo_url is set", async () => {
    await renderGuestPage({
      detail: { ...BASE_DETAIL, photo_url: "https://cdn.allarounder.it/guests/mario.jpg" },
      articles: [],
    });
    const img = document.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toContain(encodeURIComponent("https://cdn.allarounder.it/guests/mario.jpg"));
  });

  it("renders empty state when no articles", async () => {
    await renderGuestPage({ detail: BASE_DETAIL, articles: [] });
    expect(screen.getByText(/nessun articolo/i)).toBeInTheDocument();
  });

  it("renders article list with links", async () => {
    await renderGuestPage({
      detail: BASE_DETAIL,
      articles: [
        {
          id: "art-1",
          title: "Articolo con ospite",
          slug: "articolo-con-ospite",
          excerpt: "Un estratto",
          cover_image_url: null,
          cover_image_alt: null,
          reading_time: 5,
          publish_at: "2026-06-01T00:00:00Z",
        },
      ],
    });
    const link = screen.getByRole("link", { name: "Articolo con ospite" });
    expect(link).toHaveAttribute("href", "/articoli/articolo-con-ospite");
    expect(screen.getByText("Un estratto")).toBeInTheDocument();
  });

  it("renders social links", async () => {
    await renderGuestPage({
      detail: { ...BASE_DETAIL, links: { Twitter: "https://twitter.com/mario" } },
      articles: [],
    });
    const link = screen.getByRole("link", { name: "Twitter" });
    expect(link).toHaveAttribute("href", "https://twitter.com/mario");
  });

  it("calls notFound when guest not found", async () => {
    const result = await renderGuestPage(null);
    expect(result).toBe("notFound");
  });
});

describe("generateMetadata", () => {
  it("returns title and bio as description when bio is set", async () => {
    getGuestBySlug.mockReturnValueOnce({ detail: BASE_DETAIL, articles: [] });
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "mario-bianchi" }) });
    expect(meta.title).toBe("Mario Bianchi — Allarounder");
    expect(meta.description).toBe("Ospite del podcast.");
  });

  it("returns fallback description when bio is null", async () => {
    getGuestBySlug.mockReturnValueOnce({ detail: { ...BASE_DETAIL, bio: null }, articles: [] });
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "mario-bianchi" }) });
    expect(meta.description).toBe("Articoli con Mario Bianchi su Allarounder");
  });

  it("returns empty object when guest not found", async () => {
    getGuestBySlug.mockReturnValueOnce(null);
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "missing" }) });
    expect(meta).toEqual({});
  });
});
