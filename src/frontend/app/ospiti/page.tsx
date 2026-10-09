import type { Metadata } from "next";
import { getGuestIndex } from "../../lib/content";
import { TaxonomyIndex } from "../_components/TaxonomyIndex";

export const metadata: Metadata = {
  title: { absolute: "Ospiti — Allarounder" },
  description: "Gli ospiti intervistati da Allarounder e dal podcast.",
  alternates: { canonical: "https://allarounder.it/ospiti" },
};

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
