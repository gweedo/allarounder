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
    <main className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Ospiti</h1>
        <Link href="/admin/guests/new">
          <button type="button" className="btn btn-primary">
            Nuovo ospite
          </button>
        </Link>
      </div>
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
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
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <div>
                <strong>{guest.name}</strong>
                <span className="article-meta" style={{ marginLeft: "0.5rem" }}>
                  /{guest.slug}
                </span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Link href={`/admin/guests/${guest.id}`}>Modifica</Link>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => void handleDelete(guest.id)}
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
