import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

let mockPush: ReturnType<typeof vi.fn>;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("next/dynamic", () => ({
  default: (_loader: unknown) =>
    function MockEditor({
      value,
      onChange,
    }: {
      value: string;
      onChange: (v: string) => void;
    }) {
      return (
        <textarea
          data-testid="markdown-editor"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    },
}));

const PAGES = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    title: "Chi siamo",
    slug: "chi-siamo",
    updated_at: "2026-06-01T00:00:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    title: "Contatti",
    slug: "contatti",
    updated_at: "2026-06-01T00:00:00Z",
  },
];

beforeEach(() => {
  mockPush = vi.fn();
  global.fetch = vi.fn();
  vi.resetModules();
});

describe("AdminPagesPage", () => {
  it("shows loading state initially", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(new Promise(() => {}));
    const { default: AdminPagesPage } = await import("../page");
    render(<AdminPagesPage />);
    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
  });

  it("renders list of static pages", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: PAGES }),
    });
    const { default: AdminPagesPage } = await import("../page");
    render(<AdminPagesPage />);
    await waitFor(() => expect(screen.getByText("Chi siamo")).toBeInTheDocument());
    expect(screen.getByText("Contatti")).toBeInTheDocument();
  });

  it("shows Modifica link for each page", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: PAGES }),
    });
    const { default: AdminPagesPage } = await import("../page");
    render(<AdminPagesPage />);
    await waitFor(() => {
      const links = screen.getAllByRole("link", { name: /modifica/i });
      expect(links).toHaveLength(2);
    });
  });

  it("shows error on fetch failure", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });
    const { default: AdminPagesPage } = await import("../page");
    render(<AdminPagesPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});

describe("EditStaticPagePage", () => {
  const PAGE_DATA = {
    id: "00000000-0000-0000-0000-000000000001",
    title: "Chi siamo",
    slug: "chi-siamo",
    body: "## Chi siamo\n\nTesto.",
    meta_title: "Chi siamo — Allarounder",
    meta_description: "Scopri chi siamo.",
    updated_at: "2026-06-01T00:00:00Z",
  };

  it("renders page title in heading", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => PAGE_DATA,
    });
    const { default: EditStaticPagePage } = await import("../[id]/page");
    render(
      await (async () => {
        return <EditStaticPagePage params={Promise.resolve({ id: PAGE_DATA.id })} />;
      })(),
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Chi siamo"),
    );
  });

  it("renders Salva button", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => PAGE_DATA,
    });
    const { default: EditStaticPagePage } = await import("../[id]/page");
    render(<EditStaticPagePage params={Promise.resolve({ id: PAGE_DATA.id })} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /salva/i })).toBeInTheDocument(),
    );
  });

  it("shows error alert when GET returns ok: false", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });
    const { default: EditStaticPagePage } = await import("../[id]/page");
    render(<EditStaticPagePage params={Promise.resolve({ id: "some-id" })} />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("Pagina non trovata.");
  });

  it("redirects to /admin/pages on save success", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => PAGE_DATA,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => PAGE_DATA,
      });
    const { default: EditStaticPagePage } = await import("../[id]/page");
    render(<EditStaticPagePage params={Promise.resolve({ id: PAGE_DATA.id })} />);
    await waitFor(() => screen.getByRole("button", { name: /salva/i }));
    fireEvent.click(screen.getByRole("button", { name: /salva/i }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/admin/pages"));
  });

  it("shows save error alert when PUT returns ok: false", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => PAGE_DATA,
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: "Errore salvataggio" }),
      });
    const { default: EditStaticPagePage } = await import("../[id]/page");
    render(<EditStaticPagePage params={Promise.resolve({ id: PAGE_DATA.id })} />);
    await waitFor(() => screen.getByRole("button", { name: /salva/i }));
    fireEvent.click(screen.getByRole("button", { name: /salva/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("Errore salvataggio");
  });
});
