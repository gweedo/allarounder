// PROTOTYPE (#189), throwaway, never merge to main.
// Athlete page (#1) with counters + CSS histogram (#4). Two variants, both in
// the static HTML, toggled by the floating switcher:
//   A: one chronological table per season (Gymternet style)
//   B: grouped by level → competition → apparatus, qualifica next to finale (FIG/Olympedia style)
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  APPARATUS_LABEL, APPARATUS_ORDER, DISCIPLINE_LABEL, NATION_LABEL, ROUND_LABEL, SEASON,
  athleteBySlug, athleteSummary, athletes, formatDate, formatScore,
  type AthleteEntry, type Apparatus, type Competition,
} from "../../_prototype/data";
import { AppHeader, Breadcrumb, Counter, MedalTag, StatTable } from "../../_prototype/ui";
import { VariantSwitcher } from "../../_prototype/VariantSwitcher";

interface Props { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return athletes.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = athleteBySlug(slug);
  if (!a) return {};
  const s = athleteSummary(slug);
  return {
    title: { absolute: `${a.name}: punteggi e risultati ${SEASON} — Allarounder` },
    description: `${a.name} (${NATION_LABEL[a.nation]}), ginnastica artistica ${DISCIPLINE_LABEL[a.discipline].toLowerCase()}: ${s.competitions} gare, ${s.finals} finali, ${s.medals.tutte.totale} medaglie nel ${SEASON}.`,
  };
}

const ROUND_ORDER = { qualifica: 0, prova: 0, "finale-aa": 1, finale: 2 } as const;

function VariantA({ entries, apps }: { entries: AthleteEntry[]; apps: Apparatus[] }) {
  return (
    <section className="variant-a" aria-labelledby="risultati-a">
      <h2 id="risultati-a">Risultati {SEASON}</h2>
      <StatTable caption={`Stagione ${SEASON}: punteggi per gara e fase`}>
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col" className="sticky">Gara</th>
            <th scope="col">Fase</th>
            {apps.map((a) => <AppHeader key={a} app={a} />)}
            <th scope="col" className="num"><abbr title="All-around">AA</abbr></th>
            <th scope="col" className="num"><abbr title="Posizione">Pos.</abbr></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const r = e.result;
            const aa = e.phase.apparatus === "AA";
            return (
              <tr key={`${e.competition.slug}-${e.phase.round}-${e.phase.apparatus}`}>
                <td>{formatDate(e.competition.startDate).replace(/ \d{4}$/, "")}</td>
                <th scope="row" className="sticky">
                  <Link href={`/statistiche/gare/${e.competition.slug}`}>{e.competition.name}</Link>
                </th>
                <td>{aa ? ROUND_LABEL[e.phase.round] : `Finale ${APPARATUS_LABEL[e.phase.apparatus].toLowerCase()}`}</td>
                {apps.map((a) => (
                  <td key={a} className="num">
                    {aa ? formatScore(r.parts?.[a]) : a === e.phase.apparatus ? <strong>{formatScore(r.total)}</strong> : "—"}
                  </td>
                ))}
                <td className="num total">{aa ? formatScore(r.total) : "—"}</td>
                <td className="num">{r.rank}<MedalTag medal={e.medal} /></td>
              </tr>
            );
          })}
        </tbody>
      </StatTable>
    </section>
  );
}

function VariantB({ entries, apps }: { entries: AthleteEntry[]; apps: Apparatus[] }) {
  const byComp = new Map<string, { c: Competition; list: AthleteEntry[] }>();
  for (const e of entries) {
    const g = byComp.get(e.competition.slug) ?? { c: e.competition, list: [] };
    g.list.push(e);
    byComp.set(e.competition.slug, g);
  }
  const levels = [
    { key: "internazionale", label: "Gare internazionali" },
    { key: "nazionale", label: "Gare nazionali" },
  ] as const;

  const cell = (rank?: number, score?: number, medal?: AthleteEntry["medal"]) =>
    score === undefined ? (
      <><td className="num">—</td><td className="num">—</td></>
    ) : (
      <><td className="num">{rank}<MedalTag medal={medal} /></td><td className="num">{formatScore(score)}</td></>
    );

  return (
    <section className="variant-b" aria-labelledby="risultati-b">
      <h2 id="risultati-b">Risultati {SEASON}</h2>
      {levels.map((lvl) => {
        const comps = [...byComp.values()].filter((g) => g.c.level === lvl.key).reverse();
        if (!comps.length) return null;
        return (
          <div key={lvl.key}>
            <h3>{lvl.label}</h3>
            {comps.map(({ c, list }) => {
              const qual = list.find((e) => e.phase.apparatus === "AA" && e.phase.round !== "finale-aa");
              const aaFinal = list.find((e) => e.phase.round === "finale-aa");
              // Rank on one apparatus inside an AA session, computed from parts.
              const partRank = (e: AthleteEntry | undefined, a: Apparatus) => {
                if (!e || e.result.parts?.[a] === undefined) return undefined;
                const mine = e.result.parts[a]!;
                return 1 + e.phase.results.filter((r) => (r.parts?.[a] ?? -1) > mine).length;
              };
              return (
                <StatTable key={c.slug} caption={<><Link href={`/statistiche/gare/${c.slug}`}>{c.name}</Link> · {formatDate(c.startDate)}</>}>
                  <thead>
                    <tr>
                      <th scope="col" className="sticky">Attrezzo</th>
                      <th scope="col" className="num" colSpan={2}>{qual?.phase.round === "prova" ? "Gara unica" : "Qualificazioni"}</th>
                      <th scope="col" className="num" colSpan={2}>Finale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["AA", ...apps] as Apparatus[]).map((a) => {
                      const fin = a === "AA" ? aaFinal : list.find((e) => e.phase.round === "finale" && e.phase.apparatus === a);
                      const qScore = a === "AA" ? qual?.result.total : qual?.result.parts?.[a];
                      const qRank = a === "AA" ? qual?.result.rank : partRank(qual, a);
                      if (qScore === undefined && !fin) return null;
                      return (
                        <tr key={a}>
                          <th scope="row" className="sticky">{APPARATUS_LABEL[a]}</th>
                          {cell(qRank, qScore)}
                          {cell(fin?.result.rank, fin?.result.total, fin?.medal)}
                        </tr>
                      );
                    })}
                  </tbody>
                </StatTable>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}

export default async function AthletePage({ params }: Props) {
  const { slug } = await params;
  const a = athleteBySlug(slug);
  if (!a) notFound();
  const s = athleteSummary(slug);
  const apps = APPARATUS_ORDER[a.discipline];
  const entries = [...s.entries].sort(
    (x, y) => x.competition.startDate.localeCompare(y.competition.startDate) || ROUND_ORDER[x.phase.round] - ROUND_ORDER[y.phase.round],
  );
  const medalPct = s.finals ? Math.round((s.medals.tutte.totale / s.finals) * 100) : 0;
  const maxPos = Math.max(1, ...s.positions);

  return (
    <main id="contenuto" className="page-container page-container--wide stats-page has-switcher">
      <Breadcrumb items={[{ name: "Home", href: "/" }, { name: "Statistiche", href: "/statistiche" }, { name: "Atleti", href: "/statistiche/atleti" }, { name: a.name }]} />
      <p className="stats-kicker">Ginnastica artistica {DISCIPLINE_LABEL[a.discipline].toLowerCase()}</p>
      <h1>{a.name}</h1>

      <dl className="athlete-facts">
        <div><dt>Nazione</dt><dd>{NATION_LABEL[a.nation]}</dd></div>
        <div><dt>Anno di nascita</dt><dd>{a.birthYear}</dd></div>
        {a.club && <div><dt>Società</dt><dd>{a.club}</dd></div>}
        <div><dt>Specialità</dt><dd>{DISCIPLINE_LABEL[a.discipline]}</dd></div>
      </dl>

      <div className="two-col">
        <section aria-labelledby="medagliere">
          <h2 id="medagliere">Medagliere {SEASON}</h2>
          <div className="medal-box">
            <div className="oro"><strong>{s.medals.tutte.oro}</strong><span>Oro</span></div>
            <div className="argento"><strong>{s.medals.tutte.argento}</strong><span>Argento</span></div>
            <div className="bronzo"><strong>{s.medals.tutte.bronzo}</strong><span>Bronzo</span></div>
            <div className="totale"><strong>{s.medals.tutte.totale}</strong><span>Totale</span></div>
          </div>
          <p className="stats-updated">
            Internazionali: {s.medals.internazionale.totale} · Nazionali: {s.medals.nazionale.totale}. Contano solo le finali.
          </p>
          <div className="stat-counters">
            <Counter value={s.competitions} label="Gare" />
            <Counter value={s.finals} label="Finali" />
            <Counter value={`${medalPct}%`} label="Finali a medaglia" note={`${s.medals.tutte.totale} su ${s.finals}`} />
            <Counter value={formatScore(s.bestAA)} label="Miglior AA" />
          </div>
        </section>

        <section aria-labelledby="piazzamenti">
          <h2 id="piazzamenti">Piazzamenti in finale</h2>
          <ol className="histogram" aria-describedby="piazzamenti-nota">
            {s.positions.map((n, i) => (
              <li key={i}>
                <span className="count">{n}</span>
                <span className="bar" style={{ height: `${(n / maxPos) * 80}%` }} aria-hidden="true" />
                <span className="pos">{i + 1}°</span>
              </li>
            ))}
          </ol>
          <p id="piazzamenti-nota" className="stats-updated">
            Quante volte ha chiuso in ciascuna posizione, su {s.finals} finali. Grafico solo CSS: i numeri restano testo.
          </p>
        </section>
      </div>

      <VariantA entries={entries} apps={apps} />
      <VariantB entries={entries} apps={apps} />

      <VariantSwitcher />
    </main>
  );
}
