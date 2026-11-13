// PROTOTYPE (#189), throwaway, never merge to main. Invented data only.
// Types preview the step-2 stats contract: competition → phase → result.
// Medals, leaderboards and counters are derived here, never stored.
import raw from "./fixtures.json";

export type Discipline = "MAG" | "WAG";
export type Apparatus = "FX" | "PH" | "SR" | "VT" | "PB" | "HB" | "UB" | "BB" | "AA";
export type Round = "qualifica" | "finale-aa" | "finale" | "prova";

export interface Athlete {
  slug: string;
  name: string;
  nation: string;
  discipline: Discipline;
  birthYear: number;
  club?: string;
}
export interface Routine { d: number; e: number; bonus?: number; penalty: number; total: number }
export interface Result {
  athlete: string;
  rank: number;
  total: number;
  d?: number; e?: number; bonus?: number; penalty?: number; // single apparatus
  vaults?: Routine[];                                       // VT final: average of two
  parts?: Partial<Record<Apparatus, number>>;               // AA: per-apparatus totals
}
export interface Phase { round: Round; discipline: Discipline; apparatus: Apparatus; results: Result[] }
export interface Competition {
  slug: string; name: string;
  level: "internazionale" | "nazionale";
  tier: string; city: string; country: string;
  startDate: string; endDate: string;
  summary?: string;
  phases: Phase[];
}

const data = raw as unknown as {
  season: number; updatedAt: string; athletes: Athlete[]; competitions: Competition[];
};

export const SEASON = data.season;
export const UPDATED_AT = data.updatedAt;
export const athletes = data.athletes;
export const competitions = [...data.competitions].sort((a, b) => a.startDate.localeCompare(b.startDate));

export const APPARATUS_ORDER: Record<Discipline, Apparatus[]> = {
  WAG: ["VT", "UB", "BB", "FX"],
  MAG: ["FX", "PH", "SR", "VT", "PB", "HB"],
};

export const APPARATUS_LABEL: Record<Apparatus, string> = {
  VT: "Volteggio", UB: "Parallele asimmetriche", BB: "Trave", FX: "Corpo libero",
  PH: "Cavallo con maniglie", SR: "Anelli", PB: "Parallele simmetriche", HB: "Sbarra",
  AA: "All-around",
};
// Short column headers; full name goes in <abbr title>.
export const APPARATUS_SHORT: Record<Apparatus, string> = {
  VT: "Volt.", UB: "Par. as.", BB: "Trave", FX: "Corpo l.",
  PH: "Cavallo", SR: "Anelli", PB: "Par. s.", HB: "Sbarra", AA: "AA",
};
export const DISCIPLINE_LABEL: Record<Discipline, string> = { WAG: "Femminile", MAG: "Maschile" };
export const ROUND_LABEL: Record<Round, string> = {
  qualifica: "Qualificazioni", "finale-aa": "Finale all-around", finale: "Finale", prova: "Gara unica",
};
export const NATION_LABEL: Record<string, string> = {
  ITA: "Italia", FRA: "Francia", GER: "Germania", GBR: "Gran Bretagna",
  NED: "Paesi Bassi", POL: "Polonia", ESP: "Spagna",
};

export const athleteBySlug = (slug: string) => athletes.find((a) => a.slug === slug);
export const competitionBySlug = (slug: string) => competitions.find((c) => c.slug === slug);

export const phaseId = (p: Phase) => `${p.discipline}-${p.round}-${p.apparatus}`.toLowerCase();
export const phaseTitle = (p: Phase) =>
  p.apparatus === "AA" && p.round !== "finale"
    ? `${ROUND_LABEL[p.round]} · ${DISCIPLINE_LABEL[p.discipline]}`
    : `${ROUND_LABEL[p.round]} ${APPARATUS_LABEL[p.apparatus].toLowerCase()} · ${DISCIPLINE_LABEL[p.discipline]}`;

const isFinal = (p: Phase) => p.round === "finale" || p.round === "finale-aa";
export type Medal = "oro" | "argento" | "bronzo";
export const medalFor = (p: Phase, rank: number): Medal | undefined =>
  isFinal(p) && rank <= 3 ? (["oro", "argento", "bronzo"] as const)[rank - 1] : undefined;

const fmtDate = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" });
export const formatDate = (iso: string) => fmtDate.format(new Date(iso + "T12:00:00Z"));
export const formatScore = (n: number | undefined) =>
  n === undefined ? "—" : n.toLocaleString("it-IT", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
export const formatD = (n: number | undefined) =>
  n === undefined ? "—" : n.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// ---- Athlete view -------------------------------------------------------

export interface AthleteEntry {
  competition: Competition;
  phase: Phase;
  result: Result;
  medal?: Medal;
}

export function entriesFor(slug: string): AthleteEntry[] {
  const out: AthleteEntry[] = [];
  for (const c of competitions)
    for (const p of c.phases) {
      const r = p.results.find((x) => x.athlete === slug);
      if (r) out.push({ competition: c, phase: p, result: r, medal: medalFor(p, r.rank) });
    }
  return out;
}

export function athleteSummary(slug: string) {
  const entries = entriesFor(slug);
  const finals = entries.filter((e) => isFinal(e.phase));
  const medals = (level?: Competition["level"]) => {
    const pick = finals.filter((e) => e.medal && (!level || e.competition.level === level));
    return {
      oro: pick.filter((e) => e.medal === "oro").length,
      argento: pick.filter((e) => e.medal === "argento").length,
      bronzo: pick.filter((e) => e.medal === "bronzo").length,
      totale: pick.length,
    };
  };
  const aaScores = entries.filter((e) => e.phase.apparatus === "AA").map((e) => e.result.total);
  // Finishing positions in finals, 1..8 (histogram).
  const positions = Array.from({ length: 8 }, (_, i) => finals.filter((e) => e.result.rank === i + 1).length);
  return {
    entries,
    finals: finals.length,
    competitions: new Set(entries.map((e) => e.competition.slug)).size,
    medals: { internazionale: medals("internazionale"), nazionale: medals("nazionale"), tutte: medals() },
    bestAA: aaScores.length ? Math.max(...aaScores) : undefined,
    positions,
  };
}

// ---- Season leaderboard ---------------------------------------------------

export interface BestScore { athlete: Athlete; score: number; competition: Competition; round: Round }

/** Best single score per athlete on one apparatus, all competitions in the season. */
export function seasonBest(discipline: Discipline, app: Apparatus, limit = 10): BestScore[] {
  const best = new Map<string, BestScore>();
  const consider = (slug: string, score: number, c: Competition, round: Round) => {
    const prev = best.get(slug);
    if (!prev || score > prev.score) best.set(slug, { athlete: athleteBySlug(slug)!, score, competition: c, round });
  };
  for (const c of competitions)
    for (const p of c.phases) {
      if (p.discipline !== discipline) continue;
      for (const r of p.results) {
        if (app === "AA") {
          if (p.apparatus === "AA") consider(r.athlete, r.total, c, p.round);
        } else if (p.apparatus === app) {
          // Vault: the leaderboard ranks single vaults, not the final's average.
          if (r.vaults) r.vaults.forEach((v) => consider(r.athlete, v.total, c, p.round));
          else consider(r.athlete, r.total, c, p.round);
        } else if (r.parts?.[app] !== undefined) {
          consider(r.athlete, r.parts[app]!, c, p.round);
        }
      }
    }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

export function siteCounters() {
  const scores = competitions.reduce(
    (n, c) => n + c.phases.reduce((m, p) => m + p.results.reduce((k, r) => k + (r.parts ? Object.keys(r.parts).length : r.vaults ? 2 : 1), 0), 0),
    0,
  );
  let azzurre = 0;
  let finaliAzzurre = 0;
  for (const c of competitions) {
    if (c.level !== "internazionale") continue;
    for (const p of c.phases) {
      if (!isFinal(p)) continue;
      for (const r of p.results) {
        if (athleteBySlug(r.athlete)?.nation !== "ITA") continue;
        finaliAzzurre++;
        if (r.rank <= 3) azzurre++;
      }
    }
  }
  return { gare: competitions.length, atleti: athletes.length, punteggi: scores, azzurre, finaliAzzurre };
}
