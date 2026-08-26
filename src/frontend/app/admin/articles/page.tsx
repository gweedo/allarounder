"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

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

type StatusFilter = "" | "draft" | "published" | "archived";

const FILTERS: { label: string; value: StatusFilter }[] = [
  { label: "Tutti", value: "" },
  { label: "Bozze", value: "draft" },
  { label: "Pubblicati", value: "published" },
  { label: "Archiviati", value: "archived" },
];

export default function ArticlesPage() {
  const router = useRouter();
  const [data, setData] = useState<ArticleListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusFilter>("");

  useEffect(() => {
    setLoading(true);
    const url = status
      ? `/api/admin/articles?status=${status}`
      : "/api/admin/articles";
    apiFetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Errore nel caricamento degli articoli.");
        return res.json() as Promise<ArticleListResponse>;
      })
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [status]);

  function goToArticle(id: string) {
    router.push(`/admin/articles/${id}`);
  }

  return (
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Articoli</h1>
        <Link href="/admin/articles/new">
          <button type="button" className="btn btn-primary">
            Nuovo articolo
          </button>
        </Link>
      </div>
      <div aria-label="Filtra per stato" style={{ display: "flex", gap: "0.5rem", margin: "1rem 0" }}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={status === f.value}
            className={status === f.value ? "btn btn-primary" : "btn"}
            onClick={() => setStatus(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {loading && <p>Caricamento...</p>}
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      {data && !loading && (
        <>
          <p>{data.total} articoli totali</p>
          {data.items.length === 0 ? (
            <p>Nessun articolo. Crea il primo!</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Titolo</th>
                  <th>Stato</th>
                  <th>Creato il</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((article) => (
                  <tr
                    key={article.id}
                    tabIndex={0}
                    style={{ cursor: "pointer" }}
                    onClick={() => goToArticle(article.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") goToArticle(article.id);
                    }}
                  >
                    <td>
                      <Link
                        href={`/admin/articles/${article.id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {article.title}
                      </Link>
                    </td>
                    <td>
                      <span className="badge">{article.status}</span>
                    </td>
                    <td>{new Date(article.created_at).toLocaleDateString("it-IT")}</td>
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
