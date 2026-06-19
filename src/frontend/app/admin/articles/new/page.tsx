"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function NewArticlePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { detail?: string }).detail ?? "Errore nel salvataggio.");
        return;
      }
      router.push("/admin/articles");
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Nuovo articolo</h1>
      {error && (
        <p role="alert" style={{ color: "red" }}>
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit}>
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
        <button type="submit" disabled={loading} style={{ marginTop: "1.5rem" }}>
          {loading ? "…" : "Salva bozza"}
        </button>
      </form>
    </main>
  );
}
