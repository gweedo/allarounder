import Image from "next/image";
import Link from "next/link";

interface Props {
  spotifyShowUrl: string | null;
}

// Site-wide header bar (design B · Tabellone): skip link, Double Double logo
// and wordmark home, main navigation ending in the podcast CTA. The full-width <header> carries
// the brand background; the inner wrapper holds the max-width and the grid
// that lays it out as one row on desktop and two rows on phones (globals.css).
// Every page's <main> carries id="contenuto" for the skip link.
export function SiteHeader({ spotifyShowUrl }: Props) {
  return (
    <>
      <a href="#contenuto" className="skip-link">
        Vai al contenuto
      </a>
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="site-header-brand">
            {/* Decorative (alt=""): the link's name stays the wordmark. */}
            <Image
              src="/brand/dd-logo-header.png"
              alt=""
              width={63}
              height={40}
              className="site-header-logo"
              priority
            />
            Allarounder
          </Link>
          <nav aria-label="Principale" className="site-header-nav">
            <Link href="/articoli">Articoli</Link>
            <Link href="/argomenti">Argomenti</Link>
            <Link href="/chi-siamo">Chi siamo</Link>
            {spotifyShowUrl && (
              <a
                href={spotifyShowUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="site-header-cta"
              >
                Ascolta<span className="site-header-cta-long"> il podcast</span>
              </a>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}
