import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SiteHeader } from "./_components/SiteHeader";
import { SPOTIFY_SHOW_URL } from "../lib/site";

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
    <html lang="it">
      <body>
        <SiteHeader spotifyShowUrl={SPOTIFY_SHOW_URL} />
        {children}
        <footer className="site-footer">
          <nav aria-label="Footer">
            <Link href="/chi-siamo">Chi siamo</Link>
            <Link href="/contatti">Contatti</Link>
            <Link href="/privacy-policy">Privacy Policy</Link>
            <Link href="/cookie-policy">Cookie Policy</Link>
          </nav>
          <p>© {new Date().getFullYear()} Allarounder</p>
        </footer>
      </body>
    </html>
  );
}
