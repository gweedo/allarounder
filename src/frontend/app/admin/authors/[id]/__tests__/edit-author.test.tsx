import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import EditAuthorPage from "../page";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("../../../../../lib/upload", () => ({
  uploadImage: vi.fn(),
  UploadError: class UploadError extends Error {},
}));

const AUTHOR = {
  id: "author-1",
  name: "Giulia Verdi",
  slug: "giulia-verdi",
  bio: "Scrive di sport.",
  photo_url: null,
  links: { instagram: "https://instagram.com/giulia" },
  user_id: null,
  created_at: "2026-01-01T00:00:00Z",
};

function mockParams(id: string) {
  return Promise.resolve({ id });
}

beforeEach(() => {
  global.fetch = vi.fn();
  mockPush.mockClear();
});

describe("EditAuthorPage", () => {
  it("shows loading initially then pre-fills the form", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => AUTHOR,
    });
    render(<EditAuthorPage params={mockParams("author-1")} />);
    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByDisplayValue("Giulia Verdi")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("Scrive di sport.")).toBeInTheDocument();
  });

  it("shows an error when the author is not found", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });
    render(<EditAuthorPage params={mockParams("missing")} />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("saves changes and redirects to /admin/authors", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => AUTHOR })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...AUTHOR, name: "Giulia Bianchi" }),
      });
    render(<EditAuthorPage params={mockParams("author-1")} />);
    await waitFor(() => screen.getByDisplayValue("Giulia Verdi"));

    fireEvent.change(screen.getByLabelText(/nome \*/i), {
      target: { value: "Giulia Bianchi" },
    });
    fireEvent.click(screen.getByRole("button", { name: /salva/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/admin/authors"));
    const [, putCall] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(putCall[0]).toBe("/api/admin/authors/author-1");
    expect(putCall[1]).toMatchObject({ method: "PUT" });
  });

  it("shows error when save fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => AUTHOR })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ detail: "Nome non valido" }) });
    render(<EditAuthorPage params={mockParams("author-1")} />);
    await waitFor(() => screen.getByDisplayValue("Giulia Verdi"));

    fireEvent.click(screen.getByRole("button", { name: /salva/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Nome non valido");
    });
  });

  it("uploads a new photo and shows a preview", async () => {
    const { uploadImage } = await import("../../../../../lib/upload");
    (uploadImage as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      "https://blob.example/photo.jpg"
    );
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => AUTHOR,
    });
    render(<EditAuthorPage params={mockParams("author-1")} />);
    await waitFor(() => screen.getByDisplayValue("Giulia Verdi"));

    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText(/foto/i), { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/foto caricata/i)).toBeInTheDocument();
    });
  });

  it("annulla navigates back to /admin/authors", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => AUTHOR,
    });
    render(<EditAuthorPage params={mockParams("author-1")} />);
    await waitFor(() => screen.getByDisplayValue("Giulia Verdi"));

    fireEvent.click(screen.getByRole("button", { name: /annulla/i }));
    expect(mockPush).toHaveBeenCalledWith("/admin/authors");
  });
});
