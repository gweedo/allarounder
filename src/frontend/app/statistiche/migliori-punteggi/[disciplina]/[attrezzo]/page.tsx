// PROTOTYPE (#189), throwaway, never merge to main.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  APPARATUS_LABEL, APPARATUS_SLUG, DISCIPLINE_LABEL, DISCIPLINE_SLUG, SEASON,
  leaderboardApparatus, leaderboardFromSlugs, seasonBest,
} from "../../../_prototype/data";
import { LeaderboardView } from "../../../_prototype/LeaderboardView";

interface Props { params: Promise<{ disciplina: string; attrezzo: string }> }

export function generateStaticParams() {
  return (["WAG", "MAG"] as const).flatMap((d) =>
    leaderboardApparatus(d).map((a) => ({ disciplina: DISCIPLINE_SLUG[d], attrezzo: APPARATUS_SLUG[a] })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { disciplina, attrezzo } = await params;
  const lb = leaderboardFromSlugs(disciplina, attrezzo);
  if (!lb) return {};
  const top = seasonBest(lb.discipline, lb.apparatus, 1)[0];
  const label = `${APPARATUS_LABEL[lb.apparatus]} ${DISCIPLINE_LABEL[lb.discipline].toLowerCase()}`;
  return {
    title: { absolute: `Migliori punteggi ${SEASON}: ${label} — Allarounder` },
    description: `Classifica dei migliori punteggi ${SEASON} (${label}).${top ? ` In testa ${top.athlete.name}.` : ""}`,
  };
}

export default async function BestScoresPage({ params }: Props) {
  const { disciplina, attrezzo } = await params;
  const lb = leaderboardFromSlugs(disciplina, attrezzo);
  if (!lb) notFound();
  return <LeaderboardView discipline={lb.discipline} apparatus={lb.apparatus} />;
}
