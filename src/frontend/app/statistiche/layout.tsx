// PROTOTYPE (#189), throwaway, never merge to main.
import type { Metadata } from "next";
import "./_prototype/prototype.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function StatsPrototypeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <p className="proto-banner" role="note">
        Prototipo · dati inventati. Atleti, società, sedi e punteggi sono fittizi.
      </p>
      {children}
    </>
  );
}
