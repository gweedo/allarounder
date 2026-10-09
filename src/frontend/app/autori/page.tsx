import type { Metadata } from "next";
import { getAuthorIndex } from "../../lib/content";
import { TaxonomyIndex } from "../_components/TaxonomyIndex";

export const metadata: Metadata = {
  title: { absolute: "Autori — Allarounder" },
  description: "Le firme di Allarounder.",
  alternates: { canonical: "https://allarounder.it/autori" },
};

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
