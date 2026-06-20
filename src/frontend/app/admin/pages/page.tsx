"use client";

import { useEffect, useState } from "react";

interface StaticPage {
  id: string;
  title: string;
  slug: string;
  updated_at: string;
}

export default function AdminPagesPage() {
  const [pages, setPages] = useState<StaticPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/pages", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Errore nel caricamento.");
        return res.json() as Promise<{ items: StaticPage[] }>;
      })
      .then((data) => setPages(data.items))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Caricamento...</p>;

  return (
    <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Pagine statiche</h1>
      {error && (
        <p role="alert" style={{ color: "red" }}>
          {error}
        </p>
      )}
      {pages.length === 0 ? (
        <p>Nessuna pagina trovata.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {pages.map((page) => (
            <li
              key={page.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.75rem 0",
                borderBottom: "1px solid #eee",
              }}
            >
              <div>
                <strong>{page.title}</strong>
                <span
                  style={{ color: "#888", fontSize: "0.875rem", marginLeft: "0.5rem" }}
                >
                  /{page.slug}
                </span>
              </div>
              <a href={`/admin/pages/${page.id}`}>Modifica</a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
