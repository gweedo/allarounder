import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const BASE_GUEST = {
  id: "g1",
  name: "Mario Bianchi",
  slug: "mario-bianchi",
  bio: "Ospite del podcast.",
  photo_url: null as string | null,
  links: {} as Record<string, string>,
  articles: [] as {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    cover_image_url: string | null;
    cover_image_alt: string | null;
    reading_time: number | null;
    publish_at: string;
  }[],
  total: 0,
  page: 1,
  page_size: 20,
};

beforeEach(() => {
  global.fetch = vi.fn();
});

async function renderGuestPage(data: typeof BASE_GUEST | null) {
  const GuestPage = (await import("../page")).default;

  if (!data) {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });
  } else {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => data,
    });
  }

  try {
    render(await GuestPage({ params: Promise.resolve({ slug: data?.slug ?? "missing" }) }));
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_NOT_FOUND") return "notFound";
    throw e;
  }
  return "rendered";
}

describe("GuestPage", () => {
  it("renders guest name as heading", async () => {
    await renderGuestPage(BASE_GUEST);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Mario Bianchi");
  });

  it("renders guest bio", async () => {
    await renderGuestPage(BASE_GUEST);
    expect(screen.getByText("Ospite del podcast.")).toBeInTheDocument();
  });

  it("renders photo when photo_url is set", async () => {
    await renderGuestPage({
      ...BASE_GUEST,
      photo_url: "https://cdn.allarounder.it/guests/mario.jpg",
    });
    const img = document.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toContain(encodeURIComponent("https://cdn.allarounder.it/guests/mario.jpg"));
  });

  it("renders empty state when no articles", async () => {
    await renderGuestPage(BASE_GUEST);
    expect(screen.getByText(/nessun articolo/i)).toBeInTheDocument();
  });

  it("renders article list with links", async () => {
    await renderGuestPage({
      ...BASE_GUEST,
      total: 1,
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
      ...BASE_GUEST,
      links: { Twitter: "https://twitter.com/mario" },
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
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => BASE_GUEST,
    });
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "mario-bianchi" }) });
    expect(meta.title).toBe("Mario Bianchi — Allarounder");
    expect(meta.description).toBe("Ospite del podcast.");
  });

  it("returns fallback description when bio is null", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...BASE_GUEST, bio: null }),
    });
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "mario-bianchi" }) });
    expect(meta.description).toBe("Articoli con Mario Bianchi su Allarounder");
  });

  it("returns empty object when guest not found", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false });
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "missing" }) });
    expect(meta).toEqual({});
  });
});
