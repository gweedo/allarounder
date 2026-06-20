import type { Metadata } from "next";
import Link from "next/link";

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
        {children}
        <footer
          style={{
            marginTop: "4rem",
            padding: "2rem 1rem",
            borderTop: "1px solid #eee",
            textAlign: "center",
            fontSize: "0.875rem",
            color: "#888",
          }}
        >
          <nav aria-label="Footer">
            <Link href="/chi-siamo" style={{ color: "#666", marginRight: "1.5rem" }}>
              Chi siamo
            </Link>
            <Link href="/contatti" style={{ color: "#666", marginRight: "1.5rem" }}>
              Contatti
            </Link>
            <Link href="/privacy-policy" style={{ color: "#666", marginRight: "1.5rem" }}>
              Privacy Policy
            </Link>
            <Link href="/cookie-policy" style={{ color: "#666" }}>
              Cookie Policy
            </Link>
          </nav>
          <p style={{ marginTop: "1rem" }}>© {new Date().getFullYear()} Allarounder</p>
        </footer>
      </body>
    </html>
  );
}
