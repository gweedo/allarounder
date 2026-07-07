"use client";

import { FormEvent, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../../../lib/api";
import { uploadImage } from "../../../../lib/upload";

const MarkdownEditor = dynamic(() => import("../../../../components/MarkdownEditor"), {
  ssr: false,
  loading: () => <textarea rows={15} style={{ width: "100%", fontFamily: "monospace" }} />,
});

export default function NewArticlePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleBodyImageUpload = useCallback(async (file: File): Promise<string> => {
    return uploadImage(file);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { detail?: string }).detail ?? "Errore nel salvataggio.");
        return;
      }
      router.push(`/admin/articles/${(data as { id: string }).id}`);
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Nuovo articolo</h1>
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      <form onSubmit={(e) => void handleSubmit(e)}>
        <div>
          <label htmlFor="title" className="label">
            Titolo
          </label>
          <input
            id="title"
            type="text"
            className="input"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label className="label">Testo (Markdown)</label>
          <MarkdownEditor value={body} onChange={setBody} onUploadImage={handleBodyImageUpload} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: "1.5rem" }}>
          {loading ? "…" : "Salva bozza"}
        </button>
      </form>
    </main>
  );
}
