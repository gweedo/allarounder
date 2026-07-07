import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AdminCategoriesPage from "../page";

const CATEGORIES = [
  { id: "cat-1", name: "Interviste", slug: "interviste", description: "desc1" },
  { id: "cat-2", name: "Analisi", slug: "analisi", description: null },
];

beforeEach(() => {
  global.fetch = vi.fn();
});

describe("AdminCategoriesPage", () => {
  it("shows loading state initially", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });
    render(<AdminCategoriesPage />);
    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
  });

  it("renders list of categories", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: CATEGORIES }),
    });
    render(<AdminCategoriesPage />);
    await waitFor(() => {
      expect(screen.getByText("Interviste")).toBeInTheDocument();
      expect(screen.getByText("Analisi")).toBeInTheDocument();
    });
  });

  it("renders create form", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });
    render(<AdminCategoriesPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /crea categoria/i })).toBeInTheDocument();
    });
  });

  it("creates a new category and appends it to the list", async () => {
    const newCat = { id: "cat-3", name: "Nuova", slug: "nuova", description: null };
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: CATEGORIES }) })
      .mockResolvedValueOnce({ ok: true, json: async () => newCat });
    render(<AdminCategoriesPage />);
    await waitFor(() => screen.getByLabelText(/nome/i));
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "Nuova" } });
    fireEvent.click(screen.getByRole("button", { name: /crea categoria/i }));
    await waitFor(() => {
      expect(screen.getByText("Nuova")).toBeInTheDocument();
    });
  });

  it("shows error when create fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ detail: "Accesso negato" }) });
    render(<AdminCategoriesPage />);
    await waitFor(() => screen.getByLabelText(/nome/i));
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: /crea categoria/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Accesso negato");
    });
  });

  it("shows error when initial fetch fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });
    render(<AdminCategoriesPage />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("deletes a category and removes it from the list", async () => {
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: CATEGORIES }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    render(<AdminCategoriesPage />);
    await waitFor(() => screen.getByText("Interviste"));
    fireEvent.click(screen.getAllByRole("button", { name: /elimina/i })[0]);
    await waitFor(() => {
      expect(screen.queryByText("Interviste")).not.toBeInTheDocument();
    });
  });

  it("shows error when delete fails", async () => {
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: CATEGORIES }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ detail: "Errore server" }) });
    render(<AdminCategoriesPage />);
    await waitFor(() => screen.getByText("Interviste"));
    fireEvent.click(screen.getAllByRole("button", { name: /elimina/i })[0]);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Errore server");
    });
  });

  it("edits a category inline and updates the list", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: CATEGORIES }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "cat-1", name: "Rubriche", slug: "interviste", description: "nuova desc" }),
      });
    render(<AdminCategoriesPage />);
    await waitFor(() => screen.getByText("Interviste"));

    fireEvent.click(screen.getAllByRole("button", { name: /modifica/i })[0]);
    fireEvent.change(screen.getByDisplayValue("Interviste"), { target: { value: "Rubriche" } });
    fireEvent.click(screen.getByRole("button", { name: /salva/i }));

    await waitFor(() => {
      expect(screen.getByText("Rubriche")).toBeInTheDocument();
    });
    const [, editCall] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(editCall[0]).toBe("/api/admin/categories/cat-1");
    expect(editCall[1]).toMatchObject({ method: "PUT" });
  });

  it("cancels inline edit without calling the API", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: CATEGORIES }),
    });
    render(<AdminCategoriesPage />);
    await waitFor(() => screen.getByText("Interviste"));

    fireEvent.click(screen.getAllByRole("button", { name: /modifica/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /annulla/i }));

    expect(screen.getByText("Interviste")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("shows error when edit fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: CATEGORIES }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ detail: "Nome duplicato" }) });
    render(<AdminCategoriesPage />);
    await waitFor(() => screen.getByText("Interviste"));

    fireEvent.click(screen.getAllByRole("button", { name: /modifica/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /salva/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Nome duplicato");
    });
  });
});
