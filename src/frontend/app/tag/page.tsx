import type { Metadata } from "next";
import { getTagIndex } from "../../lib/content";
import { emptyPageMetadata } from "../../lib/seo";
import { TaxonomyIndex } from "../_components/TaxonomyIndex";

export function generateMetadata(): Metadata {
  return {
    title: { absolute: "Tag — Allarounder" },
    description: "Tutti i tag degli articoli di Allarounder.",
    alternates: { canonical: "https://allarounder.it/tag" },
    ...emptyPageMetadata(getTagIndex().length),
  };
}

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
