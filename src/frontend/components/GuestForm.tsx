"use client";

import { FormEvent, useRef, useState } from "react";
import { UploadError, uploadImage } from "../lib/upload";

interface LinkRow {
  label: string;
  url: string;
}

export interface GuestFormValues {
  name: string;
  bio: string;
  photoUrl: string;
  links: Record<string, string>;
}

export interface GuestFormInitialValues {
  name?: string;
  bio?: string;
  photoUrl?: string;
  links?: Record<string, string>;
}

interface GuestFormProps {
  initialValues?: GuestFormInitialValues;
  onSubmit: (values: GuestFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

function linksToRows(links: Record<string, string> | undefined): LinkRow[] {
  if (!links) return [];
  return Object.entries(links).map(([label, url]) => ({ label, url }));
}

export default function GuestForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel,
}: GuestFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [bio, setBio] = useState(initialValues?.bio ?? "");
  const [photoUrl, setPhotoUrl] = useState(initialValues?.photoUrl ?? "");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [linkRows, setLinkRows] = useState<LinkRow[]>(linksToRows(initialValues?.links));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      await onSubmit({ name, bio, photoUrl, links });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore di rete. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      <form onSubmit={(e) => void handleSubmit(e)}>
        <div>
          <label htmlFor="guest-name" className="label">
            Nome *
          </label>
          <input
            id="guest-name"
            type="text"
            className="input"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label htmlFor="guest-bio" className="label">
            Bio
          </label>
          <textarea
            id="guest-bio"
            className="input"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label htmlFor="guest-photo" className="label">
            Foto
          </label>
          <input
            id="guest-photo"
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
            {saving ? "…" : submitLabel}
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            Annulla
          </button>
        </div>
      </form>
    </>
  );
}
