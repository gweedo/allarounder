import type { Metadata } from "next";

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
      <body>{children}</body>
    </html>
  );
}
