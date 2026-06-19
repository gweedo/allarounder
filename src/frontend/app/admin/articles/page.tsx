"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Article {
  id: string;
  title: string;
  slug: string;
  status: string;
  created_at: string;
}

interface ArticleListResponse {
  items: Article[];
  total: number;
  page: number;
  page_size: number;
}

export default function ArticlesPage() {
  const [data, setData] = useState<ArticleListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/articles", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Errore nel caricamento degli articoli.");
        return res.json() as Promise<ArticleListResponse>;
      })
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <h1>Articoli</h1>
        <Link href="/admin/articles/new">
          <button type="button">Nuovo articolo</button>
        </Link>
      </div>
      {loading && <p>Caricamento...</p>}
      {error && (
        <p role="alert" style={{ color: "red" }}>
          {error}
        </p>
      )}
      {data && (
        <>
          <p>{data.total} articoli totali</p>
          {data.items.length === 0 ? (
            <p>Nessun articolo. Crea il primo!</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ccc" }}>
                    Titolo
                  </th>
                  <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ccc" }}>
                    Stato
                  </th>
                  <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ccc" }}>
                    Creato il
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((article) => (
                  <tr key={article.id}>
                    <td style={{ padding: "0.5rem" }}>{article.title}</td>
                    <td style={{ padding: "0.5rem" }}>{article.status}</td>
                    <td style={{ padding: "0.5rem" }}>
                      {new Date(article.created_at).toLocaleDateString("it-IT")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </main>
  );
}
