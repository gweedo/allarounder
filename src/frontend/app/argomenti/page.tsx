import type { Metadata } from "next";
import { getCategoryIndex } from "../../lib/content";
import { TaxonomyIndex } from "../_components/TaxonomyIndex";

export const metadata: Metadata = {
  title: { absolute: "Argomenti — Allarounder" },
  description: "Tutti gli argomenti di Allarounder.",
  alternates: { canonical: "https://allarounder.it/argomenti" },
};

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
