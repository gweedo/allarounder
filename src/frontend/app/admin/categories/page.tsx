"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  useEffect(() => {
    apiFetch("/api/admin/categories")
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
      const res = await apiFetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDesc || undefined }),
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

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDesc(cat.description ?? "");
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditDesc("");
  }

  async function handleEdit(id: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/admin/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, description: editDesc || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { detail?: string }).detail ?? "Errore nella modifica.");
        return;
      }
      const updated = (await res.json()) as Category;
      setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setEditingId(null);
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
      const res = await apiFetch(`/api/admin/categories/${id}`, {
        method: "DELETE",
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
    <main>
      <h1>Categorie</h1>
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {categories.map((cat) => (
          <li
            key={cat.id}
            className="card"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem" }}
          >
            {editingId === cat.id ? (
              <div style={{ flex: 1, marginRight: "1rem" }}>
                <input
                  type="text"
                  className="input"
                  aria-label={`Nome categoria ${cat.name}`}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
                <textarea
                  className="input"
                  rows={2}
                  aria-label={`Descrizione categoria ${cat.name}`}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  style={{ marginTop: "0.5rem" }}
                />
              </div>
            ) : (
              <div>
                <strong>{cat.name}</strong>
                {cat.description && (
                  <span style={{ marginLeft: "0.75rem", color: "var(--color-text-muted)" }}>
                    {cat.description}
                  </span>
                )}
              </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {editingId === cat.id ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={saving}
                    onClick={() => void handleEdit(cat.id)}
                  >
                    Salva
                  </button>
                  <button type="button" className="btn" disabled={saving} onClick={cancelEdit}>
                    Annulla
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn"
                    disabled={saving}
                    onClick={() => startEdit(cat)}
                  >
                    Modifica
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={saving}
                    onClick={() => void handleDelete(cat.id)}
                  >
                    Elimina
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <section className="card" style={{ marginTop: "2rem" }}>
        <h2>Aggiungi categoria</h2>
        <form onSubmit={(e) => void handleCreate(e)}>
          <div>
            <label htmlFor="cat-name" className="label">
              Nome
            </label>
            <input
              id="cat-name"
              type="text"
              className="input"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div style={{ marginTop: "0.75rem" }}>
            <label htmlFor="cat-desc" className="label">
              Descrizione
            </label>
            <textarea
              id="cat-desc"
              className="input"
              rows={2}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: "1rem" }}>
            {saving ? "…" : "Crea categoria"}
          </button>
        </form>
      </section>
    </main>
  );
}
