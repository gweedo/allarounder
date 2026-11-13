// PROTOTYPE (#189), throwaway, never merge to main.
// Section entry: opens on women's all-around (no server-side redirect under static export).
import type { Metadata } from "next";
import { SEASON } from "../_prototype/data";
import { LeaderboardView } from "../_prototype/LeaderboardView";

export const metadata: Metadata = {
  title: { absolute: `Migliori punteggi ${SEASON} — Allarounder` },
  description: `I migliori punteggi della stagione ${SEASON} per attrezzo, femminile e maschile.`,
};

export default function BestScoresIndexPage() {
  return <LeaderboardView discipline="WAG" apparatus="AA" />;
}
