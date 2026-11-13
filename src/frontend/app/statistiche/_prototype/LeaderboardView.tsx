// PROTOTYPE (#189), throwaway, never merge to main.
// One season-best leaderboard per page; tabs are plain links (one URL each).
import Link from "next/link";
import {
  APPARATUS_LABEL, DISCIPLINE_LABEL, ROUND_LABEL, SEASON, UPDATED_AT,
  formatDate, formatScore, leaderboardApparatus, leaderboardHref, seasonBest,
  type Apparatus, type Discipline,
} from "./data";
import { AthleteLink, Breadcrumb, Nation, StatTable } from "./ui";

export function LeaderboardView({ discipline, apparatus }: { discipline: Discipline; apparatus: Apparatus }) {
  const rows = seasonBest(discipline, apparatus, 10);
  const title = `${APPARATUS_LABEL[apparatus]} · ${DISCIPLINE_LABEL[discipline]}`;
  return (
    <main id="contenuto" className="page-container page-container--wide stats-page">
      <Breadcrumb
        items={[
          { name: "Home", href: "/" },
          { name: "Statistiche", href: "/statistiche" },
          { name: "Migliori punteggi", href: "/statistiche/migliori-punteggi" },
          { name: title },
        ]}
      />
      <p className="stats-kicker">Stagione {SEASON}</p>
      <h1>Migliori punteggi</h1>
      <p className="stats-updated">Aggiornato al {formatDate(UPDATED_AT)}</p>

      <nav aria-label="Specialità" className="stats-tabs">
        {(["WAG", "MAG"] as const).map((d) => (
          <Link
            key={d}
            href={leaderboardHref(d, d === discipline ? apparatus : "AA")}
            aria-current={d === discipline ? "page" : undefined}
          >
            {DISCIPLINE_LABEL[d]}
          </Link>
        ))}
      </nav>
      <nav aria-label="Attrezzo" className="stats-tabs stats-tabs--secondary">
        {leaderboardApparatus(discipline).map((a) => (
          <Link key={a} href={leaderboardHref(discipline, a)} aria-current={a === apparatus ? "page" : undefined}>
            {APPARATUS_LABEL[a]}
          </Link>
        ))}
      </nav>

      <StatTable caption={title}>
        <thead>
          <tr>
            <th scope="col" className="num"><abbr title="Posizione">Pos.</abbr></th>
            <th scope="col" className="sticky">Atleta</th>
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
      <p className="stats-updated">
        Il miglior punteggio di ogni atleta in qualsiasi fase della stagione.
        {apparatus === "VT" && " Al volteggio conta il singolo salto, non la media di finale."}
      </p>
    </main>
  );
}
