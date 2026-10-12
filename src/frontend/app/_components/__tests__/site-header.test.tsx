import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { SiteHeader } from "../SiteHeader";

vi.mock("next/link", () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const SHOW_URL = "https://open.spotify.com/show/abc";

describe("SiteHeader", () => {
  it("renders a banner with a wordmark link back to the home page", () => {
    render(<SiteHeader spotifyShowUrl={null} />);
    const banner = screen.getByRole("banner");
    expect(within(banner).getByRole("link", { name: "Allarounder" })).toHaveAttribute("href", "/");
  });

  it("renders the three main navigation links in the nav when there is no show URL", () => {
    render(<SiteHeader spotifyShowUrl={null} />);
    const nav = screen.getByRole("navigation", { name: "Principale" });
    expect(within(nav).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Articoli", "/articoli"],
      ["Argomenti", "/argomenti"],
      ["Chi siamo", "/chi-siamo"],
    ]);
  });

  it("links to the podcast on Spotify in a new tab as the last nav link when the show URL is set", () => {
    render(<SiteHeader spotifyShowUrl={SHOW_URL} />);
    const nav = screen.getByRole("navigation", { name: "Principale" });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(4);
    const link = links[3];
    expect(link).toHaveAccessibleName("Ascolta il podcast");
    expect(link).toHaveAttribute("href", SHOW_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("omits the podcast link when the show URL is not set", () => {
    render(<SiteHeader spotifyShowUrl={null} />);
    expect(screen.queryByRole("link", { name: /ascolta/i })).toBeNull();
  });

  it("offers a skip link to the main content as the first focusable element", () => {
    const { container } = render(<SiteHeader spotifyShowUrl={SHOW_URL} />);
    const first = container.querySelector("a");
    expect(first).toHaveTextContent("Vai al contenuto");
    expect(first).toHaveAttribute("href", "#contenuto");
  });

  it("keeps header copy free of 'Leggi', which the home E2E spec clicks", () => {
    render(<SiteHeader spotifyShowUrl={SHOW_URL} />);
    expect(screen.getByRole("banner")).not.toHaveTextContent(/leggi/i);
  });
});
