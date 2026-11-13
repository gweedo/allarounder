// PROTOTYPE (#189), throwaway, never merge to main.
// Hub: short overview. Counters (#4) + entry cards to the three sections.
import type { Metadata } from "next";
import Link from "next/link";
import {
  DISCIPLINE_LABEL, SEASON, UPDATED_AT, athletes, competitions, formatDate, formatScore,
  seasonBest, siteCounters,
} from "./_prototype/data";
import { Breadcrumb, Counter } from "./_prototype/ui";

export function generateMetadata(): Metadata {
  const c = siteCounters();
  return {
    title: { absolute: `Statistiche ginnastica artistica ${SEASON} — Allarounder` },
    description: `Punteggi, classifiche e migliori punteggi della stagione ${SEASON}: ${c.gare} gare, ${c.atleti} atleti, ${c.punteggi} punteggi.`,
  };
}

export default function StatsHubPage() {
  const c = siteCounters();
  const pct = c.finaliAzzurre ? Math.round((c.azzurre / c.finaliAzzurre) * 100) : 0;
  const latest = competitions[competitions.length - 1];
  const leaders = (["WAG", "MAG"] as const).map((d) => ({ d, top: seasonBest(d, "AA", 1)[0] }));

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

      <ul className="stats-sections">
        <li>
          <h2><Link href="/statistiche/migliori-punteggi">Migliori punteggi</Link></h2>
          <p>La classifica della stagione per ogni attrezzo, femminile e maschile.</p>
          <ul className="stats-sections__facts">
            {leaders.map(({ d, top }) =>
              top ? (
                <li key={d}>
                  All-around {DISCIPLINE_LABEL[d].toLowerCase()}: <strong>{top.athlete.name}</strong> {formatScore(top.score)}
                </li>
              ) : null,
            )}
          </ul>
        </li>
        <li>
          <h2><Link href="/statistiche/gare">Gare</Link></h2>
          <p>Risultati completi con difficoltà, esecuzione e penalità, fase per fase.</p>
          <ul className="stats-sections__facts">
            <li>
              Ultima: <Link href={`/statistiche/gare/${latest.slug}`}>{latest.name}</Link> · {formatDate(latest.startDate)}
            </li>
          </ul>
        </li>
        <li>
          <h2><Link href="/statistiche/atleti">Atleti</Link></h2>
          <p>Le schede di ginnaste e ginnasti: gare, finali, medaglie.</p>
          <ul className="stats-sections__facts">
            <li>{c.atleti} schede, di cui {athletes.filter((a) => a.nation === "ITA").length} azzurri</li>
          </ul>
        </li>
      </ul>
    </main>
  );
}
