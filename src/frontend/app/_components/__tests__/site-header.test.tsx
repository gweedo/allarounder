import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { SiteHeader } from "../SiteHeader";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("SiteHeader", () => {
  it("renders a banner with a logo link back to the home page", () => {
    render(<SiteHeader spotifyShowUrl={null} />);
    const banner = screen.getByRole("banner");
    expect(within(banner).getByRole("link", { name: "Allarounder" })).toHaveAttribute("href", "/");
  });

  it("renders the main navigation", () => {
    render(<SiteHeader spotifyShowUrl={null} />);
    const nav = screen.getByRole("navigation", { name: "Principale" });
    expect(within(nav).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Articoli", "/articoli"],
      ["Argomenti", "/argomenti"],
      ["Chi siamo", "/chi-siamo"],
    ]);
  });

  it("links to the podcast on Spotify in a new tab when the show URL is set", () => {
    render(<SiteHeader spotifyShowUrl="https://open.spotify.com/show/abc" />);
    const link = screen.getByRole("link", { name: /ascolta il podcast/i });
    expect(link).toHaveAttribute("href", "https://open.spotify.com/show/abc");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("omits the podcast link when the show URL is not set", () => {
    render(<SiteHeader spotifyShowUrl={null} />);
    expect(screen.queryByRole("link", { name: /ascolta il podcast/i })).toBeNull();
  });

  it("offers a skip link to the main content as the first focusable element", () => {
    const { container } = render(<SiteHeader spotifyShowUrl={null} />);
    const first = container.querySelector("a");
    expect(first).toHaveTextContent("Vai al contenuto");
    expect(first).toHaveAttribute("href", "#contenuto");
  });
});
