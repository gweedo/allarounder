import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const BASE_PAGE = {
  id: "00000000-0000-0000-0000-000000000001",
  title: "Chi siamo",
  slug: "chi-siamo",
  body: "## Chi siamo\n\nTesto di prova.",
  meta_title: "Chi siamo — Allarounder",
  meta_description: "Scopri chi siamo.",
  updated_at: "2026-06-01T00:00:00Z",
};

beforeEach(() => {
  global.fetch = vi.fn();
  vi.resetModules();
});

async function renderStaticPage(slug: string, data: typeof BASE_PAGE | null) {
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
  const { default: StaticPageRoute } = await import("../page");
  try {
    render(await StaticPageRoute({ params: Promise.resolve({ slug }) }));
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_NOT_FOUND") return "notFound";
    throw e;
  }
  return "rendered";
}

describe("StaticPageRoute", () => {
  it("renders page title as h1", async () => {
    await renderStaticPage("chi-siamo", BASE_PAGE);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Chi siamo");
  });

  it("calls notFound for unknown slug", async () => {
    const result = await renderStaticPage("unknown-page", null);
    expect(result).toBe("notFound");
  });

  it("calls notFound when API returns 404", async () => {
    const result = await renderStaticPage("chi-siamo", null);
    expect(result).toBe("notFound");
  });

  it("renders contatti page", async () => {
    await renderStaticPage("contatti", {
      ...BASE_PAGE,
      id: "00000000-0000-0000-0000-000000000002",
      title: "Contatti",
      slug: "contatti",
    });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Contatti");
  });

  it("renders privacy-policy page", async () => {
    await renderStaticPage("privacy-policy", {
      ...BASE_PAGE,
      id: "00000000-0000-0000-0000-000000000003",
      title: "Privacy Policy",
      slug: "privacy-policy",
    });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Privacy Policy");
  });

  it("renders cookie-policy page", async () => {
    await renderStaticPage("cookie-policy", {
      ...BASE_PAGE,
      id: "00000000-0000-0000-0000-000000000004",
      title: "Cookie Policy",
      slug: "cookie-policy",
    });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Cookie Policy");
  });
});
