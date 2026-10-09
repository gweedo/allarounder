import type { Metadata } from "next";
import { getAuthorIndex } from "../../lib/content";
import { emptyPageMetadata } from "../../lib/seo";
import { TaxonomyIndex } from "../_components/TaxonomyIndex";

export function generateMetadata(): Metadata {
  return {
    title: { absolute: "Autori — Allarounder" },
    description: "Le firme di Allarounder.",
    alternates: { canonical: "https://allarounder.it/autori" },
    ...emptyPageMetadata(getAuthorIndex().length),
  };
}

export default function AuthorsIndexPage() {
  return (
    <TaxonomyIndex
      title="Autori"
      basePath="/autori"
      items={getAuthorIndex()}
      emptyText="Nessun autore ancora."
    />
  );
}
