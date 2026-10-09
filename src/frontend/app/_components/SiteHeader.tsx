import Link from "next/link";

interface Props {
  spotifyShowUrl: string | null;
}

// Site-wide header: skip link, brand link home, main navigation and the
// podcast link. Every page's <main> carries id="contenuto" for the skip link.
export function SiteHeader({ spotifyShowUrl }: Props) {
  return (
    <>
      <a href="#contenuto" className="skip-link">
        Vai al contenuto
      </a>
      <header className="site-header">
        <Link href="/" className="site-header-brand">
          Allarounder
        </Link>
        <nav aria-label="Principale" className="site-header-nav">
          <Link href="/chi-siamo">Chi siamo</Link>
          {spotifyShowUrl && (
            <a
              href={spotifyShowUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="site-header-podcast"
            >
              Ascolta il podcast
            </a>
          )}
        </nav>
      </header>
    </>
  );
}
