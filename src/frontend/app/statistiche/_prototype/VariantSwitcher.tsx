"use client";
// PROTOTYPE (#189), throwaway, never merge to main.
// Floating variant bar. Both variants are in the static HTML; this toggles
// which one is visible via data-variant on <html> and ?variant= in the URL.
// Deliberately NOT gated on NODE_ENV: the Cloudflare preview is a production
// build and the creative team needs the bar there.
import { useCallback, useEffect, useState } from "react";

const VARIANTS = [
  { key: "A", name: "Una tabella per stagione" },
  { key: "B", name: "Per livello → gara → attrezzo" },
];

export function VariantSwitcher() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("variant");
    const idx = VARIANTS.findIndex((x) => x.key === v);
    if (idx >= 0) setI(idx);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.variant = VARIANTS[i].key;
    return () => { delete document.documentElement.dataset.variant; };
  }, [i]);

  const go = useCallback((step: number) => {
    setI((cur) => {
      const next = (cur + step + VARIANTS.length) % VARIANTS.length;
      const url = new URL(window.location.href);
      url.searchParams.set("variant", VARIANTS[next].key);
      window.history.replaceState(null, "", url);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select, [contenteditable]"))) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  return (
    <div className="proto-switcher" role="group" aria-label="Variante del prototipo">
      <button type="button" onClick={() => go(-1)} aria-label="Variante precedente">←</button>
      <span aria-live="polite">
        <strong>{VARIANTS[i].key}</strong> · {VARIANTS[i].name}
      </span>
      <button type="button" onClick={() => go(1)} aria-label="Variante successiva">→</button>
    </div>
  );
}
