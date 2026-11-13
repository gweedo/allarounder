// PROTOTYPE (#189), throwaway, never merge to main.
import Link from "next/link";
import type { ReactNode } from "react";
import {
  APPARATUS_LABEL, APPARATUS_SHORT, NATION_LABEL, athleteBySlug,
  type Apparatus, type Medal,
} from "./data";

/** Shortlist #5: real <table> with caption, inside a sideways-scroll wrapper. */
export function StatTable({ caption, children, id }: { caption: ReactNode; children: ReactNode; id?: string }) {
  return (
    <div className="stat-table-wrap" id={id}>
      <table className="stat-table">
        <caption>{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export const AppHeader = ({ app }: { app: Apparatus }) => (
  <th scope="col" className="num">
    <abbr title={APPARATUS_LABEL[app]}>{APPARATUS_SHORT[app]}</abbr>
  </th>
);

export const Abbr = ({ t, children }: { t: string; children: ReactNode }) => <abbr title={t}>{children}</abbr>;

export function AthleteLink({ slug }: { slug: string }) {
  const a = athleteBySlug(slug);
  if (!a) return <>{slug}</>;
  return <Link href={`/statistiche/atleti/${a.slug}`}>{a.name}</Link>;
}

export const Nation = ({ code }: { code: string }) => <abbr title={NATION_LABEL[code] ?? code}>{code}</abbr>;

const MEDAL_TEXT: Record<Medal, string> = { oro: "Oro", argento: "Argento", bronzo: "Bronzo" };
export const MedalTag = ({ medal }: { medal?: Medal }) =>
  medal ? <span className={`medal medal--${medal}`}>{MEDAL_TEXT[medal]}</span> : null;

export function Breadcrumb({ items }: { items: { name: string; href?: string }[] }) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      ...(it.href ? { item: `https://allarounder.it${it.href}` } : {}),
    })),
  };
  return (
    <nav aria-label="Percorso" className="breadcrumb">
      <ol>
        {items.map((it) => (
          <li key={it.name}>{it.href ? <Link href={it.href}>{it.name}</Link> : <span aria-current="page">{it.name}</span>}</li>
        ))}
      </ol>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    </nav>
  );
}

/** Shortlist #4: headline counter tile. */
export const Counter = ({ value, label, note }: { value: ReactNode; label: string; note?: string }) => (
  <div className="stat-counter">
    <span className="stat-counter__value">{value}</span>
    <span className="stat-counter__label">{label}</span>
    {note && <span className="stat-counter__note">{note}</span>}
  </div>
);
