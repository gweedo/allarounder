import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, it, describe, vi, beforeEach } from "vitest";
import ArticlesPage from "../page";
import NewArticlePage from "../new/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

beforeEach(() => {
  global.fetch = vi.fn();
});

describe("ArticlesPage", () => {
  it("shows loading state initially", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      new Promise(() => {})
    );
    render(<ArticlesPage />);
    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
  });

  it("renders article list on success", async () => {
    const mockData = {
      items: [
        {
          id: "1",
          title: "Test Article",
          slug: "test-article",
          status: "draft",
          created_at: "2026-06-19T00:00:00Z",
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });
    render(<ArticlesPage />);
    await waitFor(() => {
      expect(screen.getByText("Test Article")).toBeInTheDocument();
    });
    expect(screen.getByText("draft")).toBeInTheDocument();
    expect(screen.getByText("1 articoli totali")).toBeInTheDocument();
  });

  it("shows empty state when no articles", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], total: 0, page: 1, page_size: 20 }),
    });
    render(<ArticlesPage />);
    await waitFor(() => {
      expect(screen.getByText(/nessun articolo/i)).toBeInTheDocument();
    });
  });

  it("shows error on fetch failure", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });
    render(<ArticlesPage />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("renders a link to create new article", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      new Promise(() => {})
    );
    render(<ArticlesPage />);
    expect(screen.getByRole("link", { name: /nuovo articolo/i })).toBeInTheDocument();
  });
});

describe("NewArticlePage", () => {
  it("renders title and body fields with save button", () => {
    render(<NewArticlePage />);
    expect(screen.getByLabelText(/titolo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/testo/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /salva bozza/i })
    ).toBeInTheDocument();
  });

  it("shows error on failed submit", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ detail: "Titolo troppo corto" }),
    });
    render(<NewArticlePage />);
    fireEvent.change(screen.getByLabelText(/titolo/i), {
      target: { value: "X" },
    });
    fireEvent.click(screen.getByRole("button", { name: /salva bozza/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Titolo troppo corto")).toBeInTheDocument();
    });
  });

  it("disables button while submitting", async () => {
    let resolve: (v: unknown) => void;
    const pending = new Promise((r) => (resolve = r));
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(pending);
    render(<NewArticlePage />);
    fireEvent.change(screen.getByLabelText(/titolo/i), {
      target: { value: "Il mio articolo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /salva bozza/i }));
    await waitFor(() => {
      expect(screen.getByRole("button")).toBeDisabled();
    });
    resolve!({ ok: true, json: async () => ({}) });
  });
});
