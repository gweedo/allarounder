import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Allarounder — La voce italiana sulla ginnastica artistica",
  description: "La voce italiana sulla ginnastica artistica.",
  alternates: { canonical: "https://allarounder.it" },
};

interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}

interface AuthorRef {
  id: string;
  name: string;
  slug: string;
}

interface ArticleCard {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  publish_at: string;
  reading_time: number | null;
  category: CategoryRef | null;
  author_profile: AuthorRef | null;
}

interface ArticleListResponse {
  items: ArticleCard[];
  total: number;
  page: number;
  page_size: number;
}

const PAGE_SIZE = 13;

async function getArticles(page: number): Promise<ArticleListResponse> {
  const apiUrl = process.env.API_URL ?? "http://backend:8000";
  try {
    const res = await fetch(
      `${apiUrl}/api/articles?page=${page}&page_size=${PAGE_SIZE}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return { items: [], total: 0, page, page_size: PAGE_SIZE };
    return (await res.json()) as ArticleListResponse;
  } catch {
    return { items: [], total: 0, page, page_size: PAGE_SIZE };
  }
}

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function HomePage({ searchParams }: Props) {
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);

  const data = await getArticles(page);
  const hero = page === 1 ? data.items[0] ?? null : null;
  const grid = page === 1 ? data.items.slice(1) : data.items;
  const totalPages = Math.ceil(data.total / PAGE_SIZE);

  return (
    <main style={{ maxWidth: 1100, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ marginBottom: "2rem", fontSize: "1.25rem", fontWeight: "bold" }}>
        <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
          Allarounder
        </Link>
      </h1>

      {hero && (
        <section
          style={{
            marginBottom: "3rem",
            borderBottom: "2px solid #111",
            paddingBottom: "2rem",
          }}
          aria-label="Articolo in evidenza"
        >
          {hero.cover_image_url ? (
            <div style={{ position: "relative", width: "100%", height: 400, marginBottom: "1.5rem" }}>
              <Image
                src={hero.cover_image_url}
                alt={hero.cover_image_alt ?? `Copertina: ${hero.title}`}
                fill
                style={{ objectFit: "cover", borderRadius: 8 }}
                priority
              />
            </div>
          ) : (
            <div
              aria-hidden="true"
              style={{
                width: "100%",
                height: 300,
                background: "#f0f0f0",
                borderRadius: 8,
                marginBottom: "1.5rem",
              }}
            />
          )}
          {hero.category && (
            <Link
              href={`/argomenti/${hero.category.slug}`}
              style={{
                display: "inline-block",
                background: "#111",
                color: "#fff",
                padding: "0.2rem 0.6rem",
                borderRadius: 4,
                fontSize: "0.8rem",
                textDecoration: "none",
                marginBottom: "0.75rem",
              }}
            >
              {hero.category.name}
            </Link>
          )}
          <h2 style={{ fontSize: "2rem", margin: "0 0 0.5rem" }}>
            <Link
              href={`/articoli/${hero.slug}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              {hero.title}
            </Link>
          </h2>
          {hero.excerpt && (
            <p style={{ color: "#555", fontSize: "1.1rem", margin: "0.5rem 0 1rem" }}>
              {hero.excerpt}
            </p>
          )}
          <div style={{ color: "#888", fontSize: "0.875rem", marginBottom: "1rem" }}>
            <time dateTime={hero.publish_at}>
              {new Date(hero.publish_at).toLocaleDateString("it-IT")}
            </time>
            {hero.author_profile && (
              <span style={{ marginLeft: "1rem" }}>
                di{" "}
                <Link
                  href={`/autori/${hero.author_profile.slug}`}
                  style={{ color: "#555", textDecoration: "underline" }}
                >
                  {hero.author_profile.name}
                </Link>
              </span>
            )}
          </div>
          <Link
            href={`/articoli/${hero.slug}`}
            style={{
              display: "inline-block",
              padding: "0.5rem 1.25rem",
              background: "#111",
              color: "#fff",
              borderRadius: 4,
              textDecoration: "none",
              fontWeight: "bold",
            }}
          >
            Leggi
          </Link>
        </section>
      )}

      {grid.length > 0 && (
        <section aria-label="Articoli recenti">
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "2rem",
            }}
          >
            {grid.map((article) => (
              <li key={article.id}>
                {article.cover_image_url ? (
                  <div style={{ position: "relative", width: "100%", height: 180, marginBottom: "0.75rem" }}>
                    <Image
                      src={article.cover_image_url}
                      alt={article.cover_image_alt ?? `Copertina: ${article.title}`}
                      fill
                      style={{ objectFit: "cover", borderRadius: 6 }}
                    />
                  </div>
                ) : (
                  <div
                    aria-hidden="true"
                    style={{
                      width: "100%",
                      height: 180,
                      background: "#f0f0f0",
                      borderRadius: 6,
                      marginBottom: "0.75rem",
                    }}
                  />
                )}
                {article.category && (
                  <Link
                    href={`/argomenti/${article.category.slug}`}
                    style={{
                      display: "inline-block",
                      background: "#eee",
                      color: "#333",
                      padding: "0.15rem 0.5rem",
                      borderRadius: 4,
                      fontSize: "0.75rem",
                      textDecoration: "none",
                      marginBottom: "0.5rem",
                    }}
                  >
                    {article.category.name}
                  </Link>
                )}
                <h2 style={{ margin: "0 0 0.4rem", fontSize: "1rem" }}>
                  <Link
                    href={`/articoli/${article.slug}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    {article.title}
                  </Link>
                </h2>
                {article.excerpt && (
                  <p
                    style={{
                      color: "#666",
                      fontSize: "0.875rem",
                      margin: "0 0 0.5rem",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {article.excerpt}
                  </p>
                )}
                <div style={{ color: "#999", fontSize: "0.8rem" }}>
                  <time dateTime={article.publish_at}>
                    {new Date(article.publish_at).toLocaleDateString("it-IT")}
                  </time>
                  {article.author_profile && (
                    <span style={{ marginLeft: "0.75rem" }}>
                      {article.author_profile.name}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.total === 0 && (
        <p style={{ color: "#888", textAlign: "center", marginTop: "4rem" }}>
          Nessun articolo pubblicato.
        </p>
      )}

      {totalPages > 1 && (
        <nav
          aria-label="Paginazione"
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "1rem",
            marginTop: "3rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid #eee",
          }}
        >
          {page > 1 && (
            <Link
              href={`/?page=${page - 1}`}
              style={{
                padding: "0.5rem 1rem",
                border: "1px solid #ccc",
                borderRadius: 4,
                textDecoration: "none",
                color: "#333",
              }}
            >
              ← Pagina precedente
            </Link>
          )}
          <span style={{ padding: "0.5rem 0", color: "#888" }}>
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/?page=${page + 1}`}
              style={{
                padding: "0.5rem 1rem",
                border: "1px solid #ccc",
                borderRadius: 4,
                textDecoration: "none",
                color: "#333",
              }}
            >
              Pagina successiva →
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
