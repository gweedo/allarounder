import { render, screen, waitFor } from "@testing-library/react";
import { expect, it, describe, vi, beforeEach } from "vitest";
import AdminDashboard from "../page";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

const mockDashboard = {
  my_published: [
    {
      id: "pub-1",
      title: "Articolo pubblicato",
      author_name: "Mario Rossi",
      created_at: "2026-06-01T10:00:00Z",
      updated_at: "2026-06-15T12:00:00Z",
    },
  ],
  all_drafts: [
    {
      id: "draft-1",
      title: "Bozza in corso",
      author_name: "Luigi Verdi",
      created_at: "2026-06-20T09:00:00Z",
      updated_at: "2026-06-25T11:00:00Z",
    },
  ],
};

beforeEach(() => {
  global.fetch = vi.fn();
});

describe("AdminDashboard", () => {
  it("shows loading state initially", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      new Promise(() => {})
    );
    render(<AdminDashboard />);
    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
  });

  it("renders heading and nuovo articolo button", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      new Promise(() => {})
    );
    render(<AdminDashboard />);
    expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /nuovo articolo/i })).toBeInTheDocument();
  });

  it("renders sections with articles on success", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboard,
    });
    render(<AdminDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Articolo pubblicato")).toBeInTheDocument();
      expect(screen.getByText("Bozza in corso")).toBeInTheDocument();
    });
    expect(screen.getByText("Mario Rossi", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Luigi Verdi", { exact: false })).toBeInTheDocument();
  });

  it("renders section headings and vedi tutti links", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboard,
    });
    render(<AdminDashboard />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /i miei articoli recenti/i })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /bozze/i })).toBeInTheDocument();
    });
    const links = screen.getAllByRole("link", { name: /vedi tutti/i });
    expect(links).toHaveLength(2);
  });

  it("shows empty state text when sections are empty", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ my_published: [], all_drafts: [] }),
    });
    render(<AdminDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/nessun articolo pubblicato/i)).toBeInTheDocument();
      expect(screen.getByText(/nessuna bozza/i)).toBeInTheDocument();
    });
  });

  it("shows error on fetch failure", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
    });
    render(<AdminDashboard />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("edit links point to the article editor", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboard,
    });
    render(<AdminDashboard />);
    await waitFor(() => {
      const links = screen.getAllByRole("link", { name: "Modifica" });
      expect(links[0]).toHaveAttribute("href", "/admin/articles/pub-1");
      expect(links[1]).toHaveAttribute("href", "/admin/articles/draft-1");
    });
  });
});
