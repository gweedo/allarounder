// PROTOTYPE (#189), throwaway, never merge to main.
import type { Metadata } from "next";
import { DISCIPLINE_LABEL, SEASON, athleteSummary, athletes, formatScore } from "../_prototype/data";
import { AthleteLink, Breadcrumb, Nation, StatTable } from "../_prototype/ui";

export const metadata: Metadata = {
  title: { absolute: `Atleti: punteggi e medaglie ${SEASON} — Allarounder` },
  description: `Le schede di ginnaste e ginnasti: gare, finali, medaglie e miglior all-around della stagione ${SEASON}.`,
};

export default function AthletesIndexPage() {
  return (
    <main id="contenuto" className="page-container page-container--wide stats-page">
      <Breadcrumb items={[{ name: "Home", href: "/" }, { name: "Statistiche", href: "/statistiche" }, { name: "Atleti" }]} />
      <p className="stats-kicker">Stagione {SEASON}</p>
      <h1>Atleti</h1>
      <p className="page-lede">Ogni scheda raccoglie punteggi, finali e medaglie della stagione.</p>

      {(["WAG", "MAG"] as const).map((d) => {
        const rows = athletes
          .filter((a) => a.discipline === d)
          .map((a) => ({ a, s: athleteSummary(a.slug) }))
          .sort((x, y) => y.s.medals.tutte.totale - x.s.medals.tutte.totale || x.a.name.localeCompare(y.a.name));
        return (
          <section key={d} aria-labelledby={`sp-${d}`}>
            <h2 id={`sp-${d}`}>{DISCIPLINE_LABEL[d]}</h2>
            <StatTable caption={`Atleti · ${DISCIPLINE_LABEL[d]}, stagione ${SEASON}`}>
              <thead>
                <tr>
                  <th scope="col" className="sticky">Atleta</th>
                  <th scope="col"><abbr title="Nazione">Naz.</abbr></th>
                  <th scope="col" className="num">Gare</th>
                  <th scope="col" className="num">Finali</th>
                  <th scope="col" className="num">Medaglie</th>
                  <th scope="col" className="num"><abbr title="Miglior punteggio all-around">Miglior AA</abbr></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ a, s }) => (
                  <tr key={a.slug}>
                    <th scope="row" className="sticky"><AthleteLink slug={a.slug} /></th>
                    <td><Nation code={a.nation} /></td>
                    <td className="num">{s.competitions}</td>
                    <td className="num">{s.finals}</td>
                    <td className="num total">{s.medals.tutte.totale}</td>
                    <td className="num">{formatScore(s.bestAA)}</td>
                  </tr>
                ))}
              </tbody>
            </StatTable>
          </section>
        );
      })}
    </main>
  );
}
