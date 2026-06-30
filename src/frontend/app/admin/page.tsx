"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface DashboardArticleItem {
  id: string;
  title: string;
  author_name: string;
  created_at: string;
  updated_at: string;
}

interface DashboardData {
  my_published: DashboardArticleItem[];
  all_drafts: DashboardArticleItem[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT");
}

function ArticleCard({ item }: { item: DashboardArticleItem }) {
  return (
    <div
      style={{
        padding: "0.75rem 1rem",
        borderBottom: "1px solid #eee",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
      }}
    >
      <div>
        <div style={{ fontWeight: 500 }}>{item.title}</div>
        <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.2rem" }}>
          {item.author_name} · creato {formatDate(item.created_at)} · aggiornato{" "}
          {formatDate(item.updated_at)}
        </div>
      </div>
      <Link
        href={`/admin/articles/${item.id}`}
        style={{ whiteSpace: "nowrap", fontSize: "0.9rem" }}
      >
        Modifica
      </Link>
    </div>
  );
}

function Section({
  title,
  items,
  viewAllHref,
  emptyText,
}: {
  title: string;
  items: DashboardArticleItem[];
  viewAllHref: string;
  emptyText: string;
}) {
  return (
    <section style={{ marginTop: "2rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "0.5rem",
        }}
      >
        <h2 style={{ margin: 0 }}>{title}</h2>
        <Link href={viewAllHref} style={{ fontSize: "0.9rem" }}>
          Vedi tutti
        </Link>
      </div>
      <div style={{ border: "1px solid #eee", borderRadius: 4 }}>
        {items.length === 0 ? (
          <p style={{ padding: "0.75rem 1rem", margin: 0, color: "#888" }}>{emptyText}</p>
        ) : (
          items.map((item) => <ArticleCard key={item.id} item={item} />)
        )}
      </div>
    </section>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/dashboard", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Errore nel caricamento della dashboard.");
        return res.json() as Promise<DashboardData>;
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
        <h1>Dashboard</h1>
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
          <Section
            title="I miei articoli recenti"
            items={data.my_published}
            viewAllHref="/admin/articles?status=published"
            emptyText="Nessun articolo pubblicato."
          />
          <Section
            title="Bozze"
            items={data.all_drafts}
            viewAllHref="/admin/articles?status=draft"
            emptyText="Nessuna bozza in corso."
          />
        </>
      )}
    </main>
  );
}
