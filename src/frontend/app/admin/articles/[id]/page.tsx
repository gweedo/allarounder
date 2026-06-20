"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Article {
  id: string;
  title: string;
  slug: string;
  body: string;
  status: string;
  slug_locked: boolean;
  publish_at: string | null;
  spotify_url: string | null;
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditArticlePage({ params }: Props) {
  const router = useRouter();
  const [articleId, setArticleId] = useState<string | null>(null);
  const [article, setArticle] = useState<Article | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    params.then(({ id }) => setArticleId(id));
  }, [params]);

  useEffect(() => {
    if (!articleId) return;
    fetch(`/api/admin/articles/${articleId}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Errore nel caricamento.");
        return res.json() as Promise<Article>;
      })
      .then((data) => {
        setArticle(data);
        setTitle(data.title);
        setBody(data.body);
        setSlug(data.slug);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [articleId]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!article) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/articles/${article.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          slug: article.slug_locked ? undefined : slug,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { detail?: string }).detail ?? "Errore nel salvataggio.");
        return;
      }
      setArticle(await (res.json() as Promise<Article>));
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!article) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/articles/${article.id}/publish`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { detail?: string }).detail ?? "Errore nella pubblicazione.");
        return;
      }
      setArticle(await (res.json() as Promise<Article>));
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!article) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/articles/${article.id}/archive`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { detail?: string }).detail ?? "Errore nell'archiviazione.");
        return;
      }
      router.push("/admin/articles");
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Caricamento...</p>;
  if (!article) return <p role="alert">{error ?? "Articolo non trovato."}</p>;

  return (
    <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Modifica articolo</h1>
      <p>
        Stato: <strong>{article.status}</strong>
      </p>
      {error && (
        <p role="alert" style={{ color: "red" }}>
          {error}
        </p>
      )}
      <form onSubmit={handleSave}>
        <div>
          <label htmlFor="title">Titolo</label>
          <br />
          <input
            id="title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", marginTop: "0.25rem" }}
          />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label htmlFor="slug">Slug</label>
          <br />
          {article.slug_locked ? (
            <input
              id="slug"
              type="text"
              value={slug}
              readOnly
              aria-label="slug (bloccato)"
              style={{ width: "100%", marginTop: "0.25rem", background: "#eee" }}
            />
          ) : (
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              style={{ width: "100%", marginTop: "0.25rem" }}
            />
          )}
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label htmlFor="body">Testo (Markdown)</label>
          <br />
          <textarea
            id="body"
            rows={15}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            style={{ width: "100%", marginTop: "0.25rem", fontFamily: "monospace" }}
          />
        </div>
        <button type="submit" disabled={saving} style={{ marginTop: "1.5rem" }}>
          {saving ? "…" : "Salva"}
        </button>
      </form>
      <div style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}>
        {article.status === "draft" && (
          <button type="button" onClick={handlePublish} disabled={saving}>
            Pubblica
          </button>
        )}
        {article.status !== "archived" && (
          <button type="button" onClick={handleArchive} disabled={saving}>
            Archivia
          </button>
        )}
      </div>
    </main>
  );
}
