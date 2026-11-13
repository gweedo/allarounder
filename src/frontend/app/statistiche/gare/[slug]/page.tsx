// PROTOTYPE (#189), throwaway, never merge to main.
// Event page (#2): editorial summary, one ranked table per phase with
// D / E / Bonus / Penalità / Totale, and cross-link strips.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  APPARATUS_LABEL, APPARATUS_ORDER, DISCIPLINE_LABEL, athleteBySlug, competitionBySlug, competitions,
  formatD, formatDate, formatScore, medalFor, phaseId, phaseTitle,
  type Competition, type Phase,
} from "../../_prototype/data";
import { Abbr, AppHeader, AthleteLink, Breadcrumb, MedalTag, Nation, StatTable } from "../../_prototype/ui";

interface Props { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return competitions.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = competitionBySlug(slug);
  if (!c) return {};
  const winners = c.phases
    .filter((p) => p.round === "finale-aa" || p.round === "prova")
    .map((p) => `${athleteBySlug(p.results[0].athlete)?.name} (${DISCIPLINE_LABEL[p.discipline].toLowerCase()})`);
  return {
    title: { absolute: `${c.name}: risultati e punteggi — Allarounder` },
    description: `Risultati completi ${c.name}, ${c.city}, ${formatDate(c.startDate)}.${winners.length ? ` All-around: ${winners.join(", ")}.` : ""}`,
  };
}

const pen = (n?: number) => (n ? `−${formatD(n)}` : "—");

function Pos({ p, rank }: { p: Phase; rank: number }) {
  return <td className="rank num">{rank}<MedalTag medal={medalFor(p, rank)} /></td>;
}

function PhaseTable({ p }: { p: Phase }) {
  const nameCells = (slug: string) => (
    <>
      <th scope="row" className="sticky"><AthleteLink slug={slug} /></th>
      <td><Nation code={athleteBySlug(slug)?.nation ?? ""} /></td>
    </>
  );
  const head = (
    <>
      <th scope="col" className="num"><abbr title="Posizione">Pos.</abbr></th>
      <th scope="col" className="sticky">Ginnasta</th>
      <th scope="col"><abbr title="Nazione">Naz.</abbr></th>
    </>
  );

  if (p.apparatus === "AA") {
    const apps = APPARATUS_ORDER[p.discipline];
    return (
      <StatTable caption={phaseTitle(p)}>
        <thead><tr>{head}{apps.map((a) => <AppHeader key={a} app={a} />)}<th scope="col" className="num">Totale</th></tr></thead>
        <tbody>
          {p.results.map((r) => (
            <tr key={r.athlete}>
              <Pos p={p} rank={r.rank} />{nameCells(r.athlete)}
              {apps.map((a) => <td key={a} className="num">{formatScore(r.parts?.[a])}</td>)}
              <td className="num total">{formatScore(r.total)}</td>
            </tr>
          ))}
        </tbody>
      </StatTable>
    );
  }

  if (p.apparatus === "VT" && p.results[0]?.vaults) {
    return (
      <StatTable caption={phaseTitle(p)}>
        <thead>
          <tr>
            <th scope="col" colSpan={3}></th>
            <th scope="colgroup" colSpan={4} className="num">1° salto</th>
            <th scope="colgroup" colSpan={4} className="num">2° salto</th>
            <th scope="col"></th>
          </tr>
          <tr>
            {head}
            {[1, 2].flatMap((n) => [
              <th key={`d${n}`} scope="col" className="num"><Abbr t="Difficoltà">D</Abbr></th>,
              <th key={`e${n}`} scope="col" className="num"><Abbr t="Esecuzione">E</Abbr></th>,
              <th key={`p${n}`} scope="col" className="num"><Abbr t="Penalità">Pen.</Abbr></th>,
              <th key={`t${n}`} scope="col" className="num">Punt.</th>,
            ])}
            <th scope="col" className="num">Media</th>
          </tr>
        </thead>
        <tbody>
          {p.results.map((r) => (
            <tr key={r.athlete}>
              <Pos p={p} rank={r.rank} />{nameCells(r.athlete)}
              {r.vaults!.flatMap((v, i) => [
                <td key={`d${i}`} className="num">{formatD(v.d)}</td>,
                <td key={`e${i}`} className="num">{formatScore(v.e)}</td>,
                <td key={`p${i}`} className="num">{pen(v.penalty)}</td>,
                <td key={`t${i}`} className="num">{formatScore(v.total)}</td>,
              ])}
              <td className="num total">{formatScore(r.total)}</td>
            </tr>
          ))}
        </tbody>
      </StatTable>
    );
  }

  const hasBonus = p.results.some((r) => r.bonus);
  return (
    <StatTable caption={phaseTitle(p)}>
      <thead>
        <tr>
          {head}
          <th scope="col" className="num"><Abbr t="Difficoltà">D</Abbr></th>
          <th scope="col" className="num"><Abbr t="Esecuzione">E</Abbr></th>
          {hasBonus && <th scope="col" className="num">Bonus</th>}
          <th scope="col" className="num"><Abbr t="Penalità">Pen.</Abbr></th>
          <th scope="col" className="num">Totale</th>
        </tr>
      </thead>
      <tbody>
        {p.results.map((r) => (
          <tr key={r.athlete}>
            <Pos p={p} rank={r.rank} />{nameCells(r.athlete)}
            <td className="num">{formatD(r.d)}</td>
            <td className="num">{formatScore(r.e)}</td>
            {hasBonus && <td className="num">{r.bonus ? `+${formatD(r.bonus)}` : "—"}</td>}
            <td className="num">{pen(r.penalty)}</td>
            <td className="num total">{formatScore(r.total)}</td>
          </tr>
        ))}
      </tbody>
    </StatTable>
  );
}

function sameApparatusElsewhere(c: Competition, p: Phase) {
  const out: { comp: Competition; phase: Phase }[] = [];
  for (const other of competitions) {
    if (other.slug === c.slug) continue;
    const match =
      other.phases.find((q) => q.discipline === p.discipline && q.apparatus === p.apparatus && q.round === p.round) ??
      other.phases.find((q) => q.discipline === p.discipline && q.apparatus === p.apparatus);
    if (match) out.push({ comp: other, phase: match });
  }
  return out;
}

export default async function CompetitionPage({ params }: Props) {
  const { slug } = await params;
  const c = competitionBySlug(slug);
  if (!c) notFound();
  const disciplines = (["WAG", "MAG"] as const).filter((d) => c.phases.some((p) => p.discipline === d));

  return (
    <main id="contenuto" className="page-container page-container--wide stats-page">
      <Breadcrumb items={[{ name: "Home", href: "/" }, { name: "Statistiche", href: "/statistiche" }, { name: "Gare", href: "/statistiche/gare" }, { name: c.name }]} />
      <p className="stats-kicker">{c.tier} · {c.level === "internazionale" ? "Internazionale" : "Nazionale"}</p>
      <h1>{c.name}</h1>
      <p className="stats-updated">
        {c.city} ({c.country}) · {c.startDate === c.endDate ? formatDate(c.startDate) : `${formatDate(c.startDate)} – ${formatDate(c.endDate)}`}
      </p>
      {c.summary && <p className="stats-summary">{c.summary}</p>}

      <nav aria-label="Fasi della gara" className="stats-toc">
        {disciplines.map((d) => (
          <div key={d}>
            <p className="link-strip-label">Altri attrezzi, stessa gara · {DISCIPLINE_LABEL[d]}</p>
            <ul className="link-strip">
              {c.phases.filter((p) => p.discipline === d).map((p) => (
                <li key={phaseId(p)}>
                  <a href={`#${phaseId(p)}`}>{p.apparatus === "AA" ? phaseTitle(p).split(" · ")[0] : APPARATUS_LABEL[p.apparatus]}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {disciplines.map((d) => (
        <section key={d} aria-labelledby={`sez-${d}`}>
          <h2 id={`sez-${d}`}>{DISCIPLINE_LABEL[d]}</h2>
          {c.phases.filter((p) => p.discipline === d).map((p) => {
            const others = sameApparatusElsewhere(c, p);
            return (
              <div key={phaseId(p)} id={phaseId(p)}>
                <PhaseTable p={p} />
                {others.length > 0 && (
                  <>
                    <p className="link-strip-label">
                      Stesso attrezzo, altre gare · {APPARATUS_LABEL[p.apparatus]}
                    </p>
                    <ul className="link-strip">
                      {others.map(({ comp, phase }) => (
                        <li key={comp.slug}>
                          <Link href={`/statistiche/gare/${comp.slug}#${phaseId(phase)}`}>{comp.name}</Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </main>
  );
}
