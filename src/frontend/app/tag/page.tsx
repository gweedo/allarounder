import type { Metadata } from "next";
import { getTagIndex } from "../../lib/content";
import { TaxonomyIndex } from "../_components/TaxonomyIndex";

export const metadata: Metadata = {
  title: { absolute: "Tag — Allarounder" },
  description: "Tutti i tag degli articoli di Allarounder.",
  alternates: { canonical: "https://allarounder.it/tag" },
};

export default function TagsIndexPage() {
  return (
    <TaxonomyIndex
      title="Tag"
      basePath="/tag"
      items={getTagIndex()}
      emptyText="Nessun tag ancora."
      namePrefix="#"
    />
  );
}
