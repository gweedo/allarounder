import { render, screen } from "@testing-library/react";
import { expect, it, vi, beforeEach } from "vitest";
import { usePathname, useRouter } from "next/navigation";
import AdminLayout from "../layout";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

beforeEach(() => {
  vi.mocked(useRouter).mockReturnValue({
    push: vi.fn(),
  } as unknown as ReturnType<typeof useRouter>);
});

it("renders children", () => {
  vi.mocked(usePathname).mockReturnValue("/admin");
  render(
    <AdminLayout>
      <div>test content</div>
    </AdminLayout>
  );
  expect(screen.getByText("test content")).toBeInTheDocument();
});

it("wraps children with the admin shell chrome on non-login routes", () => {
  vi.mocked(usePathname).mockReturnValue("/admin");
  render(
    <AdminLayout>
      <div>test content</div>
    </AdminLayout>
  );
  expect(
    screen.getByRole("navigation", { name: /amministrazione/i })
  ).toBeInTheDocument();
});

it("renders bare children with no shell chrome on the login route", () => {
  vi.mocked(usePathname).mockReturnValue("/admin/login");
  render(
    <AdminLayout>
      <div>login form</div>
    </AdminLayout>
  );
  expect(screen.getByText("login form")).toBeInTheDocument();
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
});
