import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AdminTagsPage from "../page";

const TAGS = [
  { id: "tag-1", name: "calcio", slug: "slug-calcio" },
  { id: "tag-2", name: "musica", slug: "slug-musica" },
];

beforeEach(() => {
  global.fetch = vi.fn();
});

describe("AdminTagsPage", () => {
  it("shows loading state initially", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(new Promise(() => {}));
    render(<AdminTagsPage />);
    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
  });

  it("renders list of tags with name and slug", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: TAGS }),
    });
    render(<AdminTagsPage />);
    await waitFor(() => {
      expect(screen.getByText("calcio")).toBeInTheDocument();
      expect(screen.getByText("musica")).toBeInTheDocument();
    });
  });

  it("shows empty state when there are no tags", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });
    render(<AdminTagsPage />);
    await waitFor(() => {
      expect(screen.getByText(/nessun tag/i)).toBeInTheDocument();
    });
  });

  it("shows error when initial fetch fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });
    render(<AdminTagsPage />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("renames a tag inline and updates the list", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: TAGS }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "tag-1", name: "pallone", slug: "calcio" }),
      });
    render(<AdminTagsPage />);
    await waitFor(() => screen.getByText("calcio"));

    fireEvent.click(screen.getAllByRole("button", { name: /modifica/i })[0]);
    const input = screen.getByDisplayValue("calcio");
    fireEvent.change(input, { target: { value: "pallone" } });
    fireEvent.click(screen.getByRole("button", { name: /salva/i }));

    await waitFor(() => {
      expect(screen.getByText("pallone")).toBeInTheDocument();
    });
    const [, renameCall] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(renameCall[0]).toBe("/api/admin/tags/tag-1");
    expect(renameCall[1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({ name: "pallone" }),
    });
  });

  it("shows error when rename fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: TAGS }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ detail: "Errore" }) });
    render(<AdminTagsPage />);
    await waitFor(() => screen.getByText("calcio"));

    fireEvent.click(screen.getAllByRole("button", { name: /modifica/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /salva/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Errore");
    });
  });

  it("cancels inline rename without calling the API", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: TAGS }),
    });
    render(<AdminTagsPage />);
    await waitFor(() => screen.getByText("calcio"));

    fireEvent.click(screen.getAllByRole("button", { name: /modifica/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /annulla/i }));

    expect(screen.getByText("calcio")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("deletes a tag after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: TAGS }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    render(<AdminTagsPage />);
    await waitFor(() => screen.getByText("calcio"));

    fireEvent.click(screen.getAllByRole("button", { name: /elimina/i })[0]);

    expect(window.confirm).toHaveBeenCalledWith("Eliminare il tag «calcio»?");
    await waitFor(() => {
      expect(screen.queryByText("calcio")).not.toBeInTheDocument();
    });
  });

  it("does not delete when confirmation is declined", async () => {
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: TAGS }),
    });
    render(<AdminTagsPage />);
    await waitFor(() => screen.getByText("calcio"));

    fireEvent.click(screen.getAllByRole("button", { name: /elimina/i })[0]);

    expect(screen.getByText("calcio")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("shows error when delete fails", async () => {
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: TAGS }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ detail: "Errore server" }) });
    render(<AdminTagsPage />);
    await waitFor(() => screen.getByText("calcio"));

    fireEvent.click(screen.getAllByRole("button", { name: /elimina/i })[0]);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Errore server");
    });
  });
});
