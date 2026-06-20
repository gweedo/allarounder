"use client";

import { FormEvent, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";

const MarkdownEditor = dynamic(() => import("../../../../components/MarkdownEditor"), {
  ssr: false,
  loading: () => <textarea rows={15} style={{ width: "100%", fontFamily: "monospace" }} />,
});

interface StaticPage {
  id: string;
  title: string;
  slug: string;
  body: string;
  meta_title: string | null;
  meta_description: string | null;
  updated_at: string;
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditStaticPagePage({ params }: Props) {
  const router = useRouter();
  const [pageId, setPageId] = useState<string | null>(null);
  const [page, setPage] = useState<StaticPage | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    void params.then(({ id }) => setPageId(id));
  }, [params]);

  useEffect(() => {
    if (!pageId) return;
    fetch(`/api/admin/pages/${pageId}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Pagina non trovata.");
        return res.json() as Promise<StaticPage>;
      })
      .then((data) => {
        setPage(data);
        setTitle(data.title);
        setBody(data.body);
        setMetaTitle(data.meta_title ?? "");
        setMetaDescription(data.meta_description ?? "");
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [pageId]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!pageId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/pages/${pageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || undefined,
          body: body || undefined,
          meta_title: metaTitle || undefined,
          meta_description: metaDescription || undefined,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError((data as { detail?: string }).detail ?? "Errore nel salvataggio.");
        return;
      }
      router.push("/admin/pages");
    } catch {
      setSaveError("Errore di rete. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Caricamento...</p>;
  if (error || !page)
    return (
      <p role="alert" style={{ color: "red" }}>
        {error ?? "Pagina non trovata."}
      </p>
    );

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>
        Modifica: <em>{page.title}</em>
      </h1>
      <p style={{ color: "#888", fontSize: "0.875rem" }}>
        URL pubblico:{" "}
        <a href={`/${page.slug}`} target="_blank" rel="noopener noreferrer">
          /{page.slug}
        </a>
      </p>
      {saveError && (
        <p role="alert" style={{ color: "red" }}>
          {saveError}
        </p>
      )}
      <form onSubmit={handleSave}>
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="page-title">Titolo *</label>
          <br />
          <input
            id="page-title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", marginTop: "0.25rem" }}
          />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="page-body">Corpo (Markdown) *</label>
          <MarkdownEditor value={body} onChange={setBody} />
        </div>
        <fieldset style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: 4 }}>
          <legend>SEO</legend>
          <div style={{ marginBottom: "0.75rem" }}>
            <label htmlFor="page-meta-title">Meta title</label>
            <br />
            <input
              id="page-meta-title"
              type="text"
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              style={{ width: "100%", marginTop: "0.25rem" }}
            />
          </div>
          <div>
            <label htmlFor="page-meta-desc">Meta description</label>
            <br />
            <textarea
              id="page-meta-desc"
              rows={2}
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              style={{ width: "100%", marginTop: "0.25rem" }}
            />
          </div>
        </fieldset>
        <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem" }}>
          <button type="submit" disabled={saving}>
            {saving ? "Salvataggio…" : "Salva"}
          </button>
          <Link href="/admin/pages">Annulla</Link>
        </div>
      </form>
    </main>
  );
}
