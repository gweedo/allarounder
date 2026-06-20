"use client";

import { useEffect, useState } from "react";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/categories", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Errore nel caricamento.");
        return res.json() as Promise<{ items: Category[] }>;
      })
      .then((data) => setCategories(data.items))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDesc || undefined }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { detail?: string }).detail ?? "Errore nella creazione.");
        return;
      }
      const created = (await res.json()) as Category;
      setCategories((prev) => [...prev, created]);
      setNewName("");
      setNewDesc("");
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminare questa categoria?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        setError((data as { detail?: string }).detail ?? "Errore nell'eliminazione.");
        return;
      }
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Caricamento...</p>;

  return (
    <main style={{ maxWidth: 700, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Categorie</h1>
      {error && (
        <p role="alert" style={{ color: "red" }}>
          {error}
        </p>
      )}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {categories.map((cat) => (
          <li
            key={cat.id}
            style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem 0", borderBottom: "1px solid #eee" }}
          >
            <div>
              <strong>{cat.name}</strong>
              {cat.description && (
                <span style={{ marginLeft: "0.75rem", color: "#666" }}>{cat.description}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void handleDelete(cat.id)}
              disabled={saving}
              style={{ color: "red", background: "none", border: "none", cursor: "pointer" }}
            >
              Elimina
            </button>
          </li>
        ))}
      </ul>
      <h2 style={{ marginTop: "2rem" }}>Aggiungi categoria</h2>
      <form onSubmit={(e) => void handleCreate(e)}>
        <div>
          <label htmlFor="cat-name">Nome</label>
          <br />
          <input
            id="cat-name"
            type="text"
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ width: "100%", marginTop: "0.25rem" }}
          />
        </div>
        <div style={{ marginTop: "0.75rem" }}>
          <label htmlFor="cat-desc">Descrizione</label>
          <br />
          <textarea
            id="cat-desc"
            rows={2}
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            style={{ width: "100%", marginTop: "0.25rem" }}
          />
        </div>
        <button type="submit" disabled={saving} style={{ marginTop: "1rem" }}>
          {saving ? "…" : "Crea categoria"}
        </button>
      </form>
    </main>
  );
}
