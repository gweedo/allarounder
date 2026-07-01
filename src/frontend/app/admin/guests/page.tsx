"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Ospiti</h1>
        <Link href="/admin/guests/new">
          <button type="button">Nuovo ospite</button>
        </Link>
      </div>
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
                <Link href={`/admin/guests/${guest.id}`}>Modifica</Link>
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
    </main>
  );
}
