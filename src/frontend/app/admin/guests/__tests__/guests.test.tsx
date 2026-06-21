import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const GUEST = {
  id: "g1",
  name: "Mario Bianchi",
  slug: "mario-bianchi",
  bio: null as string | null,
  photo_url: null as string | null,
  links: {} as Record<string, string>,
};

beforeEach(() => {
  global.fetch = vi.fn();
});

async function renderGuestsPage() {
  const AdminGuestsPage = (await import("../page")).default;
  render(<AdminGuestsPage />);
}

describe("AdminGuestsPage", () => {
  it("shows loading state initially", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });
    await renderGuestsPage();
    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
  });

  it("renders empty state when no guests", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });
    await renderGuestsPage();
    await waitFor(() => expect(screen.getByText(/nessun ospite/i)).toBeInTheDocument());
  });

  it("renders guest list", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [GUEST] }),
    });
    await renderGuestsPage();
    await waitFor(() => expect(screen.getByText("Mario Bianchi")).toBeInTheDocument());
  });

  it("shows error when fetch fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });
    await renderGuestsPage();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  it("creates a new guest on form submit", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...GUEST, name: "Nuovo Ospite", id: "g2" }),
      });
    await renderGuestsPage();
    await waitFor(() => expect(screen.getByLabelText(/nome/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/nome \*/i), {
      target: { value: "Nuovo Ospite" },
    });
    fireEvent.click(screen.getByRole("button", { name: /crea ospite/i }));
    await waitFor(() => expect(screen.getByText("Nuovo Ospite")).toBeInTheDocument());
  });

  it("shows create error when POST fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: "Nome non valido" }),
      });
    await renderGuestsPage();
    await waitFor(() => expect(screen.getByLabelText(/nome \*/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/nome \*/i), {
      target: { value: "X" },
    });
    fireEvent.click(screen.getByRole("button", { name: /crea ospite/i }));
    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      expect(alerts.some((el) => el.textContent?.includes("Nome non valido"))).toBe(true);
    });
  });

  it("removes a guest from the list after delete", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [GUEST] }) })
      .mockResolvedValueOnce({ ok: true });
    await renderGuestsPage();
    await waitFor(() => expect(screen.getByText("Mario Bianchi")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /elimina/i }));
    await waitFor(() => expect(screen.queryByText("Mario Bianchi")).not.toBeInTheDocument());
  });
});
