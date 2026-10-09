import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TaxonomyIndex } from "../TaxonomyIndex";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("TaxonomyIndex", () => {
  it("renders the title as h1 and one linked entry per item with its count", () => {
    render(
      <TaxonomyIndex
        title="Argomenti"
        basePath="/argomenti"
        emptyText="Nessun argomento."
        items={[
          { slug: "analisi", name: "Analisi", article_count: 2, description: "Approfondimenti." },
          { slug: "interviste", name: "Interviste", article_count: 1 },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Argomenti");
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).getByRole("link", { name: "Analisi" })).toHaveAttribute("href", "/argomenti/analisi");
    expect(items[0]).toHaveTextContent("Approfondimenti.");
    expect(items[0]).toHaveTextContent("2 articoli");
    expect(items[1]).toHaveTextContent("1 articolo");
  });

  it("says when a category has no articles yet", () => {
    render(
      <TaxonomyIndex
        title="Argomenti"
        basePath="/argomenti"
        emptyText="Nessun argomento."
        items={[{ slug: "roundtable", name: "Roundtable", article_count: 0 }]}
      />,
    );
    expect(screen.getByRole("listitem")).toHaveTextContent("Ancora nessun articolo");
  });

  it("renders the empty text instead of a list when there are no items", () => {
    render(<TaxonomyIndex title="Ospiti" basePath="/ospiti" emptyText="Nessun ospite ancora." items={[]} />);
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByText("Nessun ospite ancora.")).toBeInTheDocument();
  });

  it("can prefix names, e.g. # for tags", () => {
    render(
      <TaxonomyIndex
        title="Tag"
        basePath="/tag"
        namePrefix="#"
        emptyText="Nessun tag."
        items={[{ slug: "nba", name: "NBA", article_count: 1 }]}
      />,
    );
    expect(screen.getByRole("link", { name: "#NBA" })).toHaveAttribute("href", "/tag/nba");
  });
});
