// PROTOTYPE (#189), throwaway, never merge to main.
import type { Metadata } from "next";
import Link from "next/link";
import { SEASON, athleteBySlug, competitions, formatDate } from "../_prototype/data";
import { AthleteLink, Breadcrumb, StatTable } from "../_prototype/ui";

export const metadata: Metadata = {
  title: { absolute: `Gare ${SEASON}: risultati di ginnastica artistica — Allarounder` },
  description: `Tutte le gare della stagione ${SEASON} con risultati completi: internazionali e nazionali.`,
};

const LEVELS = [
  { key: "internazionale", label: "Gare internazionali" },
  { key: "nazionale", label: "Gare nazionali" },
] as const;

export default function CompetitionsIndexPage() {
  return (
    <main id="contenuto" className="page-container page-container--wide stats-page">
      <Breadcrumb items={[{ name: "Home", href: "/" }, { name: "Statistiche", href: "/statistiche" }, { name: "Gare" }]} />
      <p className="stats-kicker">Stagione {SEASON}</p>
      <h1>Gare</h1>
      <p className="page-lede">Risultati completi gara per gara, con punteggi di difficoltà ed esecuzione.</p>

      {LEVELS.map((lvl) => {
        const list = [...competitions].filter((c) => c.level === lvl.key).reverse();
        return (
          <section key={lvl.key} aria-labelledby={`liv-${lvl.key}`}>
            <h2 id={`liv-${lvl.key}`}>{lvl.label}</h2>
            <StatTable caption={`${lvl.label} ${SEASON}`}>
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col" className="sticky">Gara</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Città</th>
                  <th scope="col">Vincitrice AA</th>
                  <th scope="col">Vincitore AA</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const aaWinner = (d: "WAG" | "MAG") => {
                    const p = c.phases.find((x) => x.discipline === d && x.apparatus === "AA" && x.round !== "qualifica");
                    const slug = p?.results[0]?.athlete;
                    return slug && athleteBySlug(slug) ? <AthleteLink slug={slug} /> : "—";
                  };
                  return (
                    <tr key={c.slug}>
                      <td>{formatDate(c.startDate)}</td>
                      <th scope="row" className="sticky"><Link href={`/statistiche/gare/${c.slug}`}>{c.name}</Link></th>
                      <td>{c.tier}</td>
                      <td>{c.city}</td>
                      <td>{aaWinner("WAG")}</td>
                      <td>{aaWinner("MAG")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </StatTable>
          </section>
        );
      })}
    </main>
  );
}
