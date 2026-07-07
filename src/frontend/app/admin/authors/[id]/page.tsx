"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../../../lib/api";
import { UploadError, uploadImage } from "../../../../lib/upload";

interface LinkRow {
  label: string;
  url: string;
}

interface Author {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  photo_url: string | null;
  links: Record<string, string>;
  user_id: string | null;
}

interface Props {
  params: Promise<{ id: string }>;
}

function linksToRows(links: Record<string, string>): LinkRow[] {
  return Object.entries(links).map(([label, url]) => ({ label, url }));
}

export default function EditAuthorPage({ params }: Props) {
  const router = useRouter();
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [author, setAuthor] = useState<Author | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [linkRows, setLinkRows] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void params.then(({ id }) => setAuthorId(id));
  }, [params]);

  useEffect(() => {
    if (!authorId) return;
    apiFetch(`/api/admin/authors/${authorId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Autore non trovato.");
        return res.json() as Promise<Author>;
      })
      .then((data) => {
        setAuthor(data);
        setName(data.name);
        setBio(data.bio ?? "");
        setPhotoUrl(data.photo_url ?? "");
        setLinkRows(linksToRows(data.links));
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [authorId]);

  function addLinkRow() {
    setLinkRows((prev) => [...prev, { label: "", url: "" }]);
  }

  function removeLinkRow(index: number) {
    setLinkRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLinkRow(index: number, field: keyof LinkRow, value: string) {
    setLinkRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  async function handlePhotoUpload(file: File) {
    setPhotoUploading(true);
    setError(null);
    try {
      const url = await uploadImage(file);
      setPhotoUrl(url);
    } catch (err) {
      setError(err instanceof UploadError ? err.message : "Errore nel caricamento della foto.");
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!authorId) return;
    setSaving(true);
    setError(null);

    const links: Record<string, string> = {};
    for (const row of linkRows) {
      if (row.label.trim() && row.url.trim()) {
        links[row.label.trim()] = row.url.trim();
      }
    }

    try {
      const res = await apiFetch(`/api/admin/authors/${authorId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          bio: bio || undefined,
          photo_url: photoUrl || undefined,
          links,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { detail?: string }).detail ?? "Errore nel salvataggio.");
        return;
      }
      router.push("/admin/authors");
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Caricamento...</p>;
  if (error || !author)
    return (
      <p role="alert" className="alert-error">
        {error ?? "Autore non trovato."}
      </p>
    );

  return (
    <main>
      <h1>Modifica autore</h1>
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      <form onSubmit={(e) => void handleSave(e)}>
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
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label htmlFor="author-photo" className="label">
            Foto
          </label>
          <input
            id="author-photo"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handlePhotoUpload(file);
            }}
          />
          {photoUploading && (
            <span style={{ marginLeft: "0.5rem", fontSize: "0.85rem", color: "#666" }}>
              Caricamento…
            </span>
          )}
          {photoUrl && !photoUploading && (
            <span style={{ marginLeft: "0.5rem", fontSize: "0.85rem", color: "green" }}>
              ✓ Foto caricata
            </span>
          )}
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label className="label">Link</label>
          {linkRows.map((row, i) => (
            <div
              key={i}
              style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.5rem" }}
            >
              <input
                type="text"
                className="input"
                aria-label={`Etichetta link ${i + 1}`}
                placeholder="Etichetta (es. instagram)"
                value={row.label}
                onChange={(e) => updateLinkRow(i, "label", e.target.value)}
                style={{ flex: 1 }}
              />
              <input
                type="url"
                className="input"
                aria-label={`URL link ${i + 1}`}
                placeholder="https://..."
                value={row.url}
                onChange={(e) => updateLinkRow(i, "url", e.target.value)}
                style={{ flex: 2 }}
              />
              <button
                type="button"
                className="btn btn-danger"
                aria-label={`Rimuovi link ${i + 1}`}
                onClick={() => removeLinkRow(i)}
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" className="btn" onClick={addLinkRow} style={{ marginTop: "0.5rem" }}>
            + Aggiungi link
          </button>
        </div>
        <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem" }}>
          <button type="submit" className="btn btn-primary" disabled={saving || photoUploading}>
            {saving ? "…" : "Salva"}
          </button>
          <button type="button" className="btn" onClick={() => router.push("/admin/authors")}>
            Annulla
          </button>
        </div>
      </form>
    </main>
  );
}
