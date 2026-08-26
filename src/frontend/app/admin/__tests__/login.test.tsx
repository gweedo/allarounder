import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, it, describe, vi, beforeEach } from "vitest";
import LoginPage from "../login/page";

// Mock Next.js router — not available in jsdom. mockSearchParams is reassigned
// per-test to simulate the `?sso=` query param the Google callback redirects with.
const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

// Mock fetch so form submission doesn't hit a real server
beforeEach(() => {
  global.fetch = vi.fn();
  mockPush.mockClear();
  mockReplace.mockClear();
  mockSearchParams = new URLSearchParams();
});

describe("LoginPage", () => {
  it("renders the login form", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: /accedi/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /accedi/i })).toBeInTheDocument();
  });

  it("renders the remember-me checkbox, checked by default", () => {
    render(<LoginPage />);
    const checkbox = screen.getByLabelText(/ricordami per 14 giorni/i);
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked();
  });

  it("sends remember_me: true by default", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "admin@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "anypassword123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /accedi/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.remember_me).toBe(true);
  });

  it("sends remember_me: false when the checkbox is unchecked", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "admin@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "anypassword123!" },
    });
    fireEvent.click(screen.getByLabelText(/ricordami per 14 giorni/i));
    fireEvent.click(screen.getByRole("button", { name: /accedi/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.remember_me).toBe(false);
  });

  it("shows error message on failed login", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ detail: "Invalid credentials" }),
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "admin@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "wrongpassword!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /accedi/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("disables the button while submitting", async () => {
    let resolve: (v: unknown) => void;
    const pending = new Promise((r) => (resolve = r));
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(pending);

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "admin@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "anypassword123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /accedi/i }));

    await waitFor(() => {
      expect(screen.getByRole("button")).toBeDisabled();
    });

    resolve!({ ok: true, json: async () => ({}) });
  });
});

describe("LoginPage — Google SSO", () => {
  it("renders a Google sign-in link pointing at the backend login route", () => {
    render(<LoginPage />);
    const link = screen.getByRole("link", { name: /accedi con google/i });
    expect(link).toHaveAttribute("href", "/api/admin/auth/google/login");
  });

  it("shows an Italian error alert when redirected with sso=error", () => {
    mockSearchParams = new URLSearchParams("sso=error");
    render(<LoginPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(/accesso google non riuscito/i);
  });

  it("does not show the SSO error alert on a normal visit", () => {
    render(<LoginPage />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("redirects client-side to /admin when sso=success", async () => {
    mockSearchParams = new URLSearchParams("sso=success");
    render(<LoginPage />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/admin");
    });
  });

  it("does not redirect when there is no sso param", () => {
    render(<LoginPage />);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
