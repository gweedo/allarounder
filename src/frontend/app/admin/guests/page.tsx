"use client";

import { FormEvent, useEffect, useState } from "react";

interface Guest {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  photo_url: string | null;
  links: Record<string, string>;
}

export default function AdminGuestsPage() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/guests", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Errore nel caricamento.");
        return res.json() as Promise<{ items: Guest[] }>;
      })
      .then((data) => setGuests(data.items))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, bio: bio || undefined }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCreateError((data as { detail?: string }).detail ?? "Errore nella creazione.");
        return;
      }
      const created = (await res.json()) as Guest;
      setGuests((prev) => [...prev, created]);
      setName("");
      setBio("");
    } catch {
      setCreateError("Errore di rete. Riprova.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/admin/guests/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setGuests((prev) => prev.filter((g) => g.id !== id));
      }
    } catch {
      // silent
    }
  }

  if (loading) return <p>Caricamento...</p>;

  return (
    <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Ospiti</h1>
      {error && <p role="alert" style={{ color: "red" }}>{error}</p>}
      {guests.length === 0 ? (
        <p>Nessun ospite creato.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {guests.map((guest) => (
            <li
              key={guest.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.75rem 0",
                borderBottom: "1px solid #eee",
              }}
            >
              <div>
                <strong>{guest.name}</strong>
                <span style={{ color: "#888", fontSize: "0.875rem", marginLeft: "0.5rem" }}>
                  /{guest.slug}
                </span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <a href={`/admin/guests/${guest.id}`}>Modifica</a>
                <button
                  type="button"
                  onClick={() => void handleDelete(guest.id)}
                  style={{ color: "red", background: "none", border: "none", cursor: "pointer" }}
                >
                  Elimina
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <section style={{ marginTop: "2rem" }}>
        <h2>Nuovo ospite</h2>
        {createError && <p role="alert" style={{ color: "red" }}>{createError}</p>}
        <form onSubmit={handleCreate}>
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
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={{ width: "100%", marginTop: "0.25rem" }}
            />
          </div>
          <button type="submit" disabled={creating} style={{ marginTop: "1rem" }}>
            {creating ? "…" : "Crea ospite"}
          </button>
        </form>
      </section>
    </main>
  );
}
