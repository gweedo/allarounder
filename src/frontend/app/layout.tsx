import type { Metadata } from "next";
import Link from "next/link";
import localFont from "next/font/local";
import "./globals.css";
import { SiteHeader } from "./_components/SiteHeader";
import { SPOTIFY_SHOW_URL } from "../lib/site";

// Brand faces, self-hosted (ADR-0019): Latin-subset woff2 files committed
// under app/fonts/ with their OFL licences. Each exposes a CSS variable on
// <html> that globals.css maps into --font-display, --font-serif and
// --font-ui. Only the display face is preloaded.
const archivoNarrow = localFont({
  src: [
    {
      path: "./fonts/archivo-narrow/archivo-narrow-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/archivo-narrow/archivo-narrow-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-archivo-narrow",
  display: "swap",
  adjustFontFallback: "Arial",
});

const literata = localFont({
  src: [
    { path: "./fonts/literata/literata-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/literata/literata-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/literata/literata-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-literata",
  display: "swap",
  adjustFontFallback: "Times New Roman",
  preload: false,
});

const barlow = localFont({
  src: [{ path: "./fonts/barlow/barlow-latin-600-normal.woff2", weight: "600", style: "normal" }],
  variable: "--font-barlow",
  display: "swap",
  adjustFontFallback: "Arial",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    template: "%s — Allarounder",
    default: "Allarounder",
  },
  description: "La voce italiana sulla ginnastica artistica.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="it"
      className={`${archivoNarrow.variable} ${literata.variable} ${barlow.variable}`}
    >
      <body>
        <SiteHeader spotifyShowUrl={SPOTIFY_SHOW_URL} />
        {children}
        <footer className="site-footer">
          <nav aria-label="Footer">
            <Link href="/chi-siamo">Chi siamo</Link>
            <Link href="/privacy-policy">Privacy Policy</Link>
            <Link href="/cookie-policy">Cookie Policy</Link>
          </nav>
          <p>© {new Date().getFullYear()} Allarounder</p>
        </footer>
      </body>
    </html>
  );
}
