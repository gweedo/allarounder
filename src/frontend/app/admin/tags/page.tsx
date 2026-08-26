"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

interface Tag {
  id: string;
  name: string;
  slug: string;
}

export default function AdminTagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    apiFetch("/api/admin/tags")
      .then((res) => {
        if (!res.ok) throw new Error("Errore nel caricamento.");
        return res.json() as Promise<{ items: Tag[] }>;
      })
      .then((data) => setTags(data.items))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function startEdit(tag: Tag) {
    setEditingId(tag.id);
    setEditName(tag.name);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  async function handleRename(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/admin/tags/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { detail?: string }).detail ?? "Errore nella rinomina.");
        return;
      }
      const updated = (await res.json()) as Tag;
      setTags((prev) => prev.map((t) => (t.id === id ? updated : t)));
      setEditingId(null);
      setEditName("");
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(tag: Tag) {
    if (!confirm(`Eliminare il tag «${tag.name}»?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/admin/tags/${tag.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        setError((data as { detail?: string }).detail ?? "Errore nell'eliminazione.");
        return;
      }
      setTags((prev) => prev.filter((t) => t.id !== tag.id));
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p>Caricamento...</p>;

  return (
    <main>
      <h1>Tag</h1>
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      <div className="card">
        {tags.length === 0 ? (
          <p>Nessun tag.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Slug</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => (
                <tr key={tag.id}>
                  <td>
                    {editingId === tag.id ? (
                      <input
                        type="text"
                        className="input"
                        aria-label={`Nome tag ${tag.name}`}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    ) : (
                      tag.name
                    )}
                  </td>
                  <td>{tag.slug}</td>
                  <td>
                    {editingId === tag.id ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={busy}
                          onClick={() => void handleRename(tag.id)}
                        >
                          Salva
                        </button>{" "}
                        <button
                          type="button"
                          className="btn"
                          disabled={busy}
                          onClick={cancelEdit}
                        >
                          Annulla
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn"
                          disabled={busy}
                          onClick={() => startEdit(tag)}
                        >
                          Modifica
                        </button>{" "}
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={busy}
                          onClick={() => void handleDelete(tag)}
                        >
                          Elimina
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
