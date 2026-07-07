"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

interface Author {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  photo_url: string | null;
  links: Record<string, string>;
  user_id: string | null;
}

export default function AdminAuthorsPage() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/authors", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Errore nel caricamento.");
        return res.json() as Promise<{ items: Author[] }>;
      })
      .then((data) => setAuthors(data.items))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/authors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, bio: bio || undefined }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCreateError((data as { detail?: string }).detail ?? "Errore nella creazione.");
        return;
      }
      const created = (await res.json()) as Author;
      setAuthors((prev) => [...prev, created]);
      setName("");
      setBio("");
    } catch {
      setCreateError("Errore di rete. Riprova.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/admin/authors/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setAuthors((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {
      // silent
    }
  }

  if (loading) return <p>Caricamento...</p>;

  return (
    <main className="page-container">
      <h1>Autori</h1>
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      {authors.length === 0 ? (
        <p>Nessun autore creato.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {authors.map((author) => (
            <li
              key={author.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.75rem 0",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <div>
                <strong>{author.name}</strong>
                <span className="article-meta" style={{ marginLeft: "0.5rem" }}>
                  /{author.slug}
                </span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Link href={`/admin/authors/${author.id}`}>Modifica</Link>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => void handleDelete(author.id)}
                >
                  Elimina
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <section className="card" style={{ marginTop: "2rem" }}>
        <h2>Nuovo autore</h2>
        {createError && (
          <p role="alert" className="alert-error">
            {createError}
          </p>
        )}
        <form onSubmit={handleCreate}>
          <div>
            <label htmlFor="author-name" className="label">
              Nome *
            </label>
            <input
              id="author-name"
              type="text"
              className="input"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div style={{ marginTop: "1rem" }}>
            <label htmlFor="author-bio" className="label">
              Bio
            </label>
            <textarea
              id="author-bio"
              className="input"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={creating} style={{ marginTop: "1rem" }}>
            {creating ? "…" : "Crea autore"}
          </button>
        </form>
      </section>
    </main>
  );
}
