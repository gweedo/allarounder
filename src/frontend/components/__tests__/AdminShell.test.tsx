import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, it, describe, vi, beforeEach } from "vitest";
import { usePathname, useRouter } from "next/navigation";
import AdminShell from "../AdminShell";

// Mock Next.js navigation hooks — not available in jsdom. Both are set up as
// plain mock functions so each test can control the return value with
// mockReturnValue, and assertions (e.g. push was called with X) are possible.
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const push = vi.fn();

beforeEach(() => {
  vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
  push.mockClear();
  global.fetch = vi.fn();
});

const NAV_ITEMS: [string, string][] = [
  ["Bacheca", "/admin"],
  ["Articoli", "/admin/articles"],
  ["Autori", "/admin/authors"],
  ["Ospiti", "/admin/guests"],
  ["Categorie", "/admin/categories"],
  ["Tag", "/admin/tags"],
  ["Pagine", "/admin/pages"],
];

describe("AdminShell", () => {
  it("renders bare children with no chrome on /admin/login", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/login");
    render(
      <AdminShell>
        <div>form content</div>
      </AdminShell>
    );
    expect(screen.getByText("form content")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /esci/i })).not.toBeInTheDocument();
  });

  it("renders all 7 nav links with correct hrefs", () => {
    vi.mocked(usePathname).mockReturnValue("/admin");
    render(
      <AdminShell>
        <div>content</div>
      </AdminShell>
    );
    const nav = screen.getByRole("navigation", { name: /amministrazione/i });
    for (const [label, href] of NAV_ITEMS) {
      const link = screen.getByRole("link", { name: label });
      expect(link).toHaveAttribute("href", href);
      expect(nav).toContainElement(link);
    }
  });

  it("marks Bacheca active only on exact /admin match", () => {
    vi.mocked(usePathname).mockReturnValue("/admin");
    render(
      <AdminShell>
        <div>content</div>
      </AdminShell>
    );
    expect(screen.getByRole("link", { name: "Bacheca" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "Articoli" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("does not mark Bacheca active on a nested admin route", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/articles");
    render(
      <AdminShell>
        <div>content</div>
      </AdminShell>
    );
    expect(screen.getByRole("link", { name: "Bacheca" })).not.toHaveAttribute(
      "aria-current"
    );
    expect(screen.getByRole("link", { name: "Articoli" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("marks a nested route active for its section (e.g. article edit page)", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/articles/abc-123");
    render(
      <AdminShell>
        <div>content</div>
      </AdminShell>
    );
    expect(screen.getByRole("link", { name: "Articoli" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("calls the logout endpoint then navigates to /admin/login", async () => {
    vi.mocked(usePathname).mockReturnValue("/admin");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true });
    render(
      <AdminShell>
        <div>content</div>
      </AdminShell>
    );
    fireEvent.click(screen.getByRole("button", { name: /esci/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/auth/logout",
        expect.objectContaining({ method: "POST", credentials: "include" })
      );
    });
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/admin/login");
    });
  });

  it("disables the Esci button while the logout request is in flight", async () => {
    vi.mocked(usePathname).mockReturnValue("/admin");
    let resolve: (v: unknown) => void;
    const pending = new Promise((r) => (resolve = r));
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(pending);
    render(
      <AdminShell>
        <div>content</div>
      </AdminShell>
    );
    const button = screen.getByRole("button", { name: /esci/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
    });

    resolve!({ ok: true });
  });
});
