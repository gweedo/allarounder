import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
  global.fetch = vi.fn();
  mockPush.mockClear();
});

async function renderNewGuestPage() {
  const NewGuestPage = (await import("../page")).default;
  render(<NewGuestPage />);
}

describe("NewGuestPage", () => {
  it("renders all form fields", async () => {
    await renderNewGuestPage();
    expect(screen.getByLabelText(/nome \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/bio/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/url foto/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crea ospite/i })).toBeInTheDocument();
  });

  it("adds and removes link rows", async () => {
    await renderNewGuestPage();
    fireEvent.click(screen.getByRole("button", { name: /aggiungi link/i }));
    expect(screen.getByLabelText(/etichetta link 1/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /rimuovi link 1/i }));
    expect(screen.queryByLabelText(/etichetta link 1/i)).not.toBeInTheDocument();
  });

  it("redirects to /admin/guests on success", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "g1", name: "Test", slug: "test", bio: null, photo_url: null, links: {}, created_at: "" }),
    });
    await renderNewGuestPage();
    fireEvent.change(screen.getByLabelText(/nome \*/i), { target: { value: "Test" } });
    fireEvent.click(screen.getByRole("button", { name: /crea ospite/i }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/admin/guests"));
  });

  it("shows error on failed submit", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: "Nome non valido" }),
    });
    await renderNewGuestPage();
    fireEvent.change(screen.getByLabelText(/nome \*/i), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: /crea ospite/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText("Nome non valido")).toBeInTheDocument();
  });

  it("annulla navigates back to /admin/guests", async () => {
    await renderNewGuestPage();
    fireEvent.click(screen.getByRole("button", { name: /annulla/i }));
    expect(mockPush).toHaveBeenCalledWith("/admin/guests");
  });

  it("disables submit button while saving", async () => {
    let resolve: (v: unknown) => void;
    const pending = new Promise((r) => (resolve = r));
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(pending);
    await renderNewGuestPage();
    fireEvent.change(screen.getByLabelText(/nome \*/i), { target: { value: "Test" } });
    fireEvent.click(screen.getByRole("button", { name: /crea ospite/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /…/i })).toBeDisabled());
    resolve!({ ok: true, json: async () => ({}) });
  });
});
