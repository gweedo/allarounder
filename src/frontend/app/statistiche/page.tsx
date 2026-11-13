// PROTOTYPE (#189), throwaway, never merge to main.
// Hub: headline counters (#4) + season best-scores leaderboard (#3) + indexes.
import type { Metadata } from "next";
import Link from "next/link";
import {
  APPARATUS_LABEL, APPARATUS_ORDER, DISCIPLINE_LABEL, ROUND_LABEL, SEASON, UPDATED_AT,
  athletes, competitions, formatDate, formatScore, seasonBest, siteCounters,
  type Apparatus, type Discipline,
} from "./_prototype/data";
import { AthleteLink, Breadcrumb, Counter, Nation, StatTable } from "./_prototype/ui";

export function generateMetadata(): Metadata {
  const c = siteCounters();
  return {
    title: { absolute: `Statistiche ginnastica artistica ${SEASON} — Allarounder` },
    description: `Punteggi, classifiche e migliori punteggi della stagione ${SEASON}: ${c.gare} gare, ${c.atleti} atleti, ${c.punteggi} punteggi.`,
  };
}

function Leaderboard({ discipline, app }: { discipline: Discipline; app: Apparatus }) {
  const rows = seasonBest(discipline, app, 8);
  return (
    <StatTable caption={`${APPARATUS_LABEL[app]} · ${DISCIPLINE_LABEL[discipline]}`}>
      <thead>
        <tr>
          <th scope="col" className="num"><abbr title="Posizione">Pos.</abbr></th>
          <th scope="col">Atleta</th>
          <th scope="col"><abbr title="Nazione">Naz.</abbr></th>
          <th scope="col" className="num">Punteggio</th>
          <th scope="col">Gara</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.athlete.slug}>
            <td className="rank num">{i + 1}</td>
            <th scope="row" className="sticky"><AthleteLink slug={r.athlete.slug} /></th>
            <td><Nation code={r.athlete.nation} /></td>
            <td className="num total">{formatScore(r.score)}</td>
            <td>
              <Link href={`/statistiche/gare/${r.competition.slug}`}>{r.competition.name}</Link>
              <span className="stats-updated"> · {ROUND_LABEL[r.round]}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </StatTable>
  );
}

export default function StatsHubPage() {
  const c = siteCounters();
  const pct = c.finaliAzzurre ? Math.round((c.azzurre / c.finaliAzzurre) * 100) : 0;
  return (
    <main id="contenuto" className="page-container page-container--wide stats-page">
      <Breadcrumb items={[{ name: "Home", href: "/" }, { name: "Statistiche" }]} />
      <p className="stats-kicker">Ginnastica artistica · stagione {SEASON}</p>
      <h1>Statistiche</h1>
      <p className="page-lede">
        Punteggi, finali e migliori punteggi della stagione, gara per gara. Testo segnaposto: qui
        la redazione presenta la sezione.
      </p>
      <p className="stats-updated">Aggiornato al {formatDate(UPDATED_AT)}</p>

      <div className="stat-counters" aria-label="Numeri della stagione">
        <Counter value={c.gare} label="Gare" />
        <Counter value={c.atleti} label="Atleti" />
        <Counter value={c.punteggi} label="Punteggi" />
        <Counter value={c.azzurre} label="Medaglie azzurre" note={`in ${c.finaliAzzurre} finali internazionali (${pct}%)`} />
      </div>

      <h2 id="migliori-punteggi">Migliori punteggi {SEASON}</h2>
      <p>
        Il miglior punteggio di ogni atleta per attrezzo, in qualsiasi fase. Al volteggio conta il
        singolo salto, non la media di finale.
      </p>
      <nav aria-label="Attrezzi" className="stats-toc">
        {(["WAG", "MAG"] as const).map((d) => (
          <div key={d}>
            <p className="link-strip-label">{DISCIPLINE_LABEL[d]}</p>
            <ul className="link-strip">
              {(["AA", ...APPARATUS_ORDER[d]] as Apparatus[]).map((a) => (
                <li key={a}><a href={`#mp-${d}-${a}`.toLowerCase()}>{APPARATUS_LABEL[a]}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {(["WAG", "MAG"] as const).map((d) => (
        <section key={d} aria-labelledby={`mp-${d}`}>
          <h3 id={`mp-${d}`}>{DISCIPLINE_LABEL[d]}</h3>
          <div className="two-col">
            {(["AA", ...APPARATUS_ORDER[d]] as Apparatus[]).map((a) => (
              <div key={a} id={`mp-${d}-${a}`.toLowerCase()}>
                <Leaderboard discipline={d} app={a} />
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="two-col">
        <section aria-labelledby="gare">
          <h2 id="gare">Gare</h2>
          <ul className="stats-list">
            {[...competitions].reverse().map((g) => (
              <li key={g.slug}>
                <Link href={`/statistiche/gare/${g.slug}`}>{g.name}</Link>
                <span className="meta">
                  {g.tier} · {g.level === "internazionale" ? "Internazionale" : "Nazionale"} · {formatDate(g.startDate)}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="atleti">
          <h2 id="atleti">Atleti</h2>
          <ul className="stats-list">
            {athletes.map((a) => (
              <li key={a.slug}>
                <Link href={`/statistiche/atleti/${a.slug}`}>{a.name}</Link>
                <span className="meta">{DISCIPLINE_LABEL[a.discipline]} · <Nation code={a.nation} /></span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
