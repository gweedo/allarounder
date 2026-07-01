"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

interface LinkRow {
  label: string;
  url: string;
}

export default function NewGuestPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [linkRows, setLinkRows] = useState<LinkRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const links: Record<string, string> = {};
    for (const row of linkRows) {
      if (row.label.trim() && row.url.trim()) {
        links[row.label.trim()] = row.url.trim();
      }
    }

    try {
      const res = await fetch("/api/admin/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          bio: bio || undefined,
          photo_url: photoUrl || undefined,
          links,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { detail?: string }).detail ?? "Errore nella creazione.");
        return;
      }
      router.push("/admin/guests");
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ maxWidth: 600, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Nuovo ospite</h1>
      {error && (
        <p role="alert" style={{ color: "red" }}>
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="guest-name">Nome *</label>
          <br />
          <input
            id="guest-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: "100%", marginTop: "0.25rem" }}
          />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label htmlFor="guest-bio">Bio</label>
          <br />
          <textarea
            id="guest-bio"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            style={{ width: "100%", marginTop: "0.25rem" }}
          />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label htmlFor="guest-photo">URL foto</label>
          <br />
          <input
            id="guest-photo"
            type="url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://..."
            style={{ width: "100%", marginTop: "0.25rem" }}
          />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label>Link</label>
          {linkRows.map((row, i) => (
            <div
              key={i}
              style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.5rem" }}
            >
              <input
                type="text"
                aria-label={`Etichetta link ${i + 1}`}
                placeholder="Etichetta (es. instagram)"
                value={row.label}
                onChange={(e) => updateLinkRow(i, "label", e.target.value)}
                style={{ flex: 1 }}
              />
              <input
                type="url"
                aria-label={`URL link ${i + 1}`}
                placeholder="https://..."
                value={row.url}
                onChange={(e) => updateLinkRow(i, "url", e.target.value)}
                style={{ flex: 2 }}
              />
              <button
                type="button"
                aria-label={`Rimuovi link ${i + 1}`}
                onClick={() => removeLinkRow(i)}
                style={{ color: "red", background: "none", border: "none", cursor: "pointer" }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addLinkRow}
            style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}
          >
            + Aggiungi link
          </button>
        </div>
        <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem" }}>
          <button type="submit" disabled={saving}>
            {saving ? "…" : "Crea ospite"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/guests")}
            style={{ background: "none", border: "1px solid #ccc", cursor: "pointer" }}
          >
            Annulla
          </button>
        </div>
      </form>
    </main>
  );
}
