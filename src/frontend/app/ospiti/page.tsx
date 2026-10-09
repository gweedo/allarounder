import type { Metadata } from "next";
import { getGuestIndex } from "../../lib/content";
import { emptyPageMetadata } from "../../lib/seo";
import { TaxonomyIndex } from "../_components/TaxonomyIndex";

export function generateMetadata(): Metadata {
  return {
    title: { absolute: "Ospiti — Allarounder" },
    description: "Gli ospiti intervistati da Allarounder e dal podcast.",
    alternates: { canonical: "https://allarounder.it/ospiti" },
    ...emptyPageMetadata(getGuestIndex().length),
  };
}

export default function GuestsIndexPage() {
  return (
    <TaxonomyIndex
      title="Ospiti"
      basePath="/ospiti"
      items={getGuestIndex()}
      emptyText="Nessun ospite ancora."
    />
  );
}
