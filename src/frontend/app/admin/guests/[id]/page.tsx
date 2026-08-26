"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GuestForm, { GuestFormValues } from "../../../../components/GuestForm";
import { apiFetch } from "../../../../lib/api";

interface Guest {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  photo_url: string | null;
  links: Record<string, string>;
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditGuestPage({ params }: Props) {
  const router = useRouter();
  const [guestId, setGuestId] = useState<string | null>(null);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void params.then(({ id }) => setGuestId(id));
  }, [params]);

  useEffect(() => {
    if (!guestId) return;
    apiFetch(`/api/admin/guests/${guestId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Ospite non trovato.");
        return res.json() as Promise<Guest>;
      })
      .then(setGuest)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [guestId]);

  async function handleSubmit(values: GuestFormValues) {
    if (!guestId) return;
    let res: Response;
    try {
      res = await apiFetch(`/api/admin/guests/${guestId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          bio: values.bio || undefined,
          photo_url: values.photoUrl || undefined,
          links: values.links,
        }),
      });
    } catch {
      throw new Error("Errore di rete. Riprova.");
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { detail?: string }).detail ?? "Errore nel salvataggio.");
    }
    router.push("/admin/guests");
  }

  if (loading) return <p>Caricamento...</p>;
  if (error || !guest)
    return (
      <p role="alert" className="alert-error">
        {error ?? "Ospite non trovato."}
      </p>
    );

  return (
    <main>
      <h1>Modifica ospite</h1>
      <GuestForm
        initialValues={{
          name: guest.name,
          bio: guest.bio ?? "",
          photoUrl: guest.photo_url ?? "",
          links: guest.links,
        }}
        onSubmit={handleSubmit}
        onCancel={() => router.push("/admin/guests")}
        submitLabel="Salva"
      />
    </main>
  );
}
