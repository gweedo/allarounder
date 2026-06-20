import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, it, describe, vi, beforeEach } from "vitest";
import AdminAuthorsPage from "../page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const AUTHOR_1 = {
  id: "a1",
  name: "Marco Rossi",
  slug: "marco-rossi",
  bio: "Giornalista sportivo.",
  photo_url: null,
  links: {},
  user_id: null,
};

beforeEach(() => {
  global.fetch = vi.fn();
});

describe("AdminAuthorsPage", () => {
  it("shows loading then renders author list", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [AUTHOR_1] }),
    });
    render(<AdminAuthorsPage />);
    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Marco Rossi")).toBeInTheDocument();
    });
  });

  it("shows empty state when no authors", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });
    render(<AdminAuthorsPage />);
    await waitFor(() => {
      expect(screen.getByText(/nessun autore/i)).toBeInTheDocument();
    });
  });

  it("creates a new author and appends to list", async () => {
    const newAuthor = { ...AUTHOR_1, id: "a2", name: "Laura Bianchi", slug: "laura-bianchi" };
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => newAuthor });
    render(<AdminAuthorsPage />);
    await waitFor(() => screen.getByLabelText(/nome/i));
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "Laura Bianchi" } });
    fireEvent.click(screen.getByRole("button", { name: /crea autore/i }));
    await waitFor(() => {
      expect(screen.getByText("Laura Bianchi")).toBeInTheDocument();
    });
  });

  it("shows error when create fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ detail: "Nome già in uso." }) });
    render(<AdminAuthorsPage />);
    await waitFor(() => screen.getByLabelText(/nome/i));
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "Dup" } });
    fireEvent.click(screen.getByRole("button", { name: /crea autore/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Nome già in uso.");
    });
  });
});
