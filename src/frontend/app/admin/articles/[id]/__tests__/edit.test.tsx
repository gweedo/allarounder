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
  excerpt: null,
  cover_image_url: null,
  cover_image_alt: null,
  meta_title: null,
  meta_description: null,
  og_image_url: null,
  reading_time: null,
  category_id: null,
};

const PUBLISHED_ARTICLE = {
  ...DRAFT_ARTICLE,
  id: "art-2",
  status: "published",
  slug_locked: true,
  publish_at: "2026-06-01T00:00:00Z",
};

// Route fetch calls by URL — categories always returns empty, articles depend on the test
function setupFetch(
  articleData: object | null,
  extraResponses: Record<string, object> = {},
) {
  (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: unknown) => {
    const u = String(url);
    if (u === "/api/admin/categories") {
      return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
    }
    for (const [pattern, resp] of Object.entries(extraResponses)) {
      if (u.includes(pattern)) {
        return Promise.resolve({ ok: true, json: async () => resp });
      }
    }
    if (articleData && u.match(/\/api\/admin\/articles\/[^/]+$/)) {
      return Promise.resolve({ ok: true, json: async () => articleData });
    }
    return Promise.resolve({ ok: false, json: async () => ({}) });
  });
}

beforeEach(() => {
  global.fetch = vi.fn();
});

function mockParams(id: string) {
  return Promise.resolve({ id });
}

describe("EditArticlePage", () => {
  it("shows loading initially then renders form", async () => {
    setupFetch(DRAFT_ARTICLE);
    render(<EditArticlePage params={mockParams("art-1")} />);
    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText(/^titolo$/i)).toBeInTheDocument();
    });
  });

  it("pre-fills title and body from loaded article", async () => {
    setupFetch(DRAFT_ARTICLE);
    render(<EditArticlePage params={mockParams("art-1")} />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Titolo Bozza")).toBeInTheDocument();
    });
  });

  it("shows editable slug field for draft", async () => {
    setupFetch(DRAFT_ARTICLE);
    render(<EditArticlePage params={mockParams("art-1")} />);
    await waitFor(() => {
      const slugInput = screen.getByLabelText(/slug/i);
      expect(slugInput).not.toHaveAttribute("readonly");
    });
  });

  it("shows read-only slug field when slug_locked", async () => {
    setupFetch(PUBLISHED_ARTICLE);
    render(<EditArticlePage params={mockParams("art-2")} />);
    await waitFor(() => {
      const slugInput = screen.getByLabelText(/slug \(bloccato\)/i);
      expect(slugInput).toHaveAttribute("readonly");
    });
  });

  it("shows Pubblica button for draft articles", async () => {
    setupFetch(DRAFT_ARTICLE);
    render(<EditArticlePage params={mockParams("art-1")} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /pubblica/i })).toBeInTheDocument();
    });
  });

  it("does not show Pubblica button for published articles", async () => {
    setupFetch(PUBLISHED_ARTICLE);
    render(<EditArticlePage params={mockParams("art-2")} />);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /pubblica/i })).toBeNull();
    });
  });

  it("shows Archivia button for non-archived articles", async () => {
    setupFetch(DRAFT_ARTICLE);
    render(<EditArticlePage params={mockParams("art-1")} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /archivia/i })).toBeInTheDocument();
    });
  });

  it("calls publish endpoint and updates status on click", async () => {
    const publishedVersion = { ...DRAFT_ARTICLE, status: "published", slug_locked: true };
    let articleFetched = false;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: unknown, opts?: RequestInit) => {
      const u = String(url);
      if (u === "/api/admin/categories") {
        return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
      }
      if (u.match(/\/api\/admin\/articles\/[^/]+$/) && (!opts || opts.method !== "POST")) {
        if (!articleFetched) { articleFetched = true; return Promise.resolve({ ok: true, json: async () => DRAFT_ARTICLE }); }
      }
      if (u.includes("/publish")) {
        return Promise.resolve({ ok: true, json: async () => publishedVersion });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });
    render(<EditArticlePage params={mockParams("art-1")} />);
    await waitFor(() => screen.getByRole("button", { name: /pubblica/i }));
    fireEvent.click(screen.getByRole("button", { name: /pubblica/i }));
    await waitFor(() => {
      expect(screen.getByText(/published/i)).toBeInTheDocument();
    });
    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const publishCall = calls.find((c: unknown[]) => String(c[0]).includes("/publish"));
    expect(publishCall).toBeTruthy();
    expect((publishCall![1] as RequestInit).method).toBe("POST");
  });

  it("shows error on fetch failure", async () => {
    setupFetch(null);
    render(<EditArticlePage params={mockParams("art-1")} />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("shows Anteprima button for all articles", async () => {
    setupFetch(DRAFT_ARTICLE);
    render(<EditArticlePage params={mockParams("art-1")} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /anteprima/i })).toBeInTheDocument();
    });
  });

  it("calls preview-token endpoint and opens new tab on click", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    setupFetch(DRAFT_ARTICLE, {
      "/preview-token": { preview_url: "/preview/articles/some-token" },
    });
    render(<EditArticlePage params={mockParams("art-1")} />);
    await waitFor(() => screen.getByRole("button", { name: /anteprima/i }));
    fireEvent.click(screen.getByRole("button", { name: /anteprima/i }));
    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        "/preview/articles/some-token",
        "_blank",
        "noopener,noreferrer"
      );
    });
    openSpy.mockRestore();
  });

  it("shows category dropdown", async () => {
    setupFetch(DRAFT_ARTICLE);
    render(<EditArticlePage params={mockParams("art-1")} />);
    await waitFor(() => {
      expect(screen.getByLabelText(/categoria/i)).toBeInTheDocument();
    });
  });
});
