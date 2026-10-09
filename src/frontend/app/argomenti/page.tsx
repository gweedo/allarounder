import type { Metadata } from "next";
import { getCategoryIndex } from "../../lib/content";
import { emptyPageMetadata } from "../../lib/seo";
import { TaxonomyIndex } from "../_components/TaxonomyIndex";

export function generateMetadata(): Metadata {
  return {
    title: { absolute: "Argomenti — Allarounder" },
    description: "Tutti gli argomenti di Allarounder.",
    alternates: { canonical: "https://allarounder.it/argomenti" },
    ...emptyPageMetadata(getCategoryIndex().length),
  };
}

export default function CategoriesIndexPage() {
  return (
    <TaxonomyIndex
      title="Argomenti"
      basePath="/argomenti"
      items={getCategoryIndex()}
      emptyText="Nessun argomento ancora."
    />
  );
}
