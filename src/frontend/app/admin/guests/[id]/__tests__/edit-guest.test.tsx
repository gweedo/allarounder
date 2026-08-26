import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import EditGuestPage from "../page";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("../../../../../lib/upload", () => ({
  uploadImage: vi.fn(),
  UploadError: class UploadError extends Error {},
}));

const GUEST = {
  id: "guest-1",
  name: "Mario Rossi",
  slug: "mario-rossi",
  bio: "Una bio",
  photo_url: null,
  links: { instagram: "https://instagram.com/mario" },
  created_at: "2026-01-01T00:00:00Z",
};

function mockParams(id: string) {
  return Promise.resolve({ id });
}

beforeEach(() => {
  global.fetch = vi.fn();
  mockPush.mockClear();
});

describe("EditGuestPage", () => {
  it("shows loading initially then pre-fills the form", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => GUEST,
    });
    render(<EditGuestPage params={mockParams("guest-1")} />);
    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByDisplayValue("Mario Rossi")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("Una bio")).toBeInTheDocument();
  });

  it("shows an error when the guest is not found", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });
    render(<EditGuestPage params={mockParams("missing")} />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("saves changes and redirects to /admin/guests", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => GUEST })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...GUEST, name: "Mario Bianchi" }) });
    render(<EditGuestPage params={mockParams("guest-1")} />);
    await waitFor(() => screen.getByDisplayValue("Mario Rossi"));

    fireEvent.change(screen.getByLabelText(/nome \*/i), { target: { value: "Mario Bianchi" } });
    fireEvent.click(screen.getByRole("button", { name: /salva/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/admin/guests"));
    const [, putCall] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(putCall[0]).toBe("/api/admin/guests/guest-1");
    expect(putCall[1]).toMatchObject({ method: "PUT" });
  });

  it("shows error when save fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => GUEST })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ detail: "Nome non valido" }) });
    render(<EditGuestPage params={mockParams("guest-1")} />);
    await waitFor(() => screen.getByDisplayValue("Mario Rossi"));

    fireEvent.click(screen.getByRole("button", { name: /salva/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Nome non valido");
    });
  });

  it("annulla navigates back to /admin/guests", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => GUEST,
    });
    render(<EditGuestPage params={mockParams("guest-1")} />);
    await waitFor(() => screen.getByDisplayValue("Mario Rossi"));

    fireEvent.click(screen.getByRole("button", { name: /annulla/i }));
    expect(mockPush).toHaveBeenCalledWith("/admin/guests");
  });
});
