import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, it, describe, vi, beforeEach } from "vitest";
import EditArticlePage from "../page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const DRAFT_ARTICLE = {
  id: "art-1",
  title: "Titolo Bozza",
  slug: "titolo-bozza",
  body: "## Corpo",
  status: "draft",
  slug_locked: false,
  publish_at: null,
  spotify_url: null,
};

const PUBLISHED_ARTICLE = {
  ...DRAFT_ARTICLE,
  id: "art-2",
  status: "published",
  slug_locked: true,
  publish_at: "2026-06-01T00:00:00Z",
};

beforeEach(() => {
  global.fetch = vi.fn();
});

function mockParams(id: string) {
  return Promise.resolve({ id });
}

describe("EditArticlePage", () => {
  it("shows loading initially then renders form", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => DRAFT_ARTICLE,
    });
    render(<EditArticlePage params={mockParams("art-1")} />);
    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText(/titolo/i)).toBeInTheDocument();
    });
  });

  it("pre-fills title and body from loaded article", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => DRAFT_ARTICLE,
    });
    render(<EditArticlePage params={mockParams("art-1")} />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Titolo Bozza")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("## Corpo")).toBeInTheDocument();
  });

  it("shows editable slug field for draft", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => DRAFT_ARTICLE,
    });
    render(<EditArticlePage params={mockParams("art-1")} />);
    await waitFor(() => {
      const slugInput = screen.getByLabelText(/slug/i);
      expect(slugInput).not.toHaveAttribute("readonly");
    });
  });

  it("shows read-only slug field when slug_locked", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => PUBLISHED_ARTICLE,
    });
    render(<EditArticlePage params={mockParams("art-2")} />);
    await waitFor(() => {
      const slugInput = screen.getByLabelText(/slug \(bloccato\)/i);
      expect(slugInput).toHaveAttribute("readonly");
    });
  });

  it("shows Pubblica button for draft articles", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => DRAFT_ARTICLE,
    });
    render(<EditArticlePage params={mockParams("art-1")} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /pubblica/i })).toBeInTheDocument();
    });
  });

  it("does not show Pubblica button for published articles", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => PUBLISHED_ARTICLE,
    });
    render(<EditArticlePage params={mockParams("art-2")} />);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /pubblica/i })).toBeNull();
    });
  });

  it("shows Archivia button for non-archived articles", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => DRAFT_ARTICLE,
    });
    render(<EditArticlePage params={mockParams("art-1")} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /archivia/i })).toBeInTheDocument();
    });
  });

  it("calls publish endpoint and updates status on click", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => DRAFT_ARTICLE })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...DRAFT_ARTICLE, status: "published", slug_locked: true }),
      });
    render(<EditArticlePage params={mockParams("art-1")} />);
    await waitFor(() => screen.getByRole("button", { name: /pubblica/i }));
    fireEvent.click(screen.getByRole("button", { name: /pubblica/i }));
    await waitFor(() => {
      expect(screen.getByText(/published/i)).toBeInTheDocument();
    });
    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[1][0]).toContain("/publish");
    expect(calls[1][1]).toMatchObject({ method: "POST" });
  });

  it("shows error on fetch failure", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });
    render(<EditArticlePage params={mockParams("art-1")} />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});
