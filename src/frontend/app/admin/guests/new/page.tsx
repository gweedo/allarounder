"use client";

import { useRouter } from "next/navigation";
import GuestForm, { GuestFormValues } from "../../../../components/GuestForm";
import { apiFetch } from "../../../../lib/api";

export default function NewGuestPage() {
  const router = useRouter();

  async function handleSubmit(values: GuestFormValues) {
    let res: Response;
    try {
      res = await apiFetch("/api/admin/guests", {
        method: "POST",
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
      throw new Error((data as { detail?: string }).detail ?? "Errore nella creazione.");
    }
    router.push("/admin/guests");
  }

  return (
    <main>
      <h1>Nuovo ospite</h1>
      <GuestForm
        onSubmit={handleSubmit}
        onCancel={() => router.push("/admin/guests")}
        submitLabel="Crea ospite"
      />
    </main>
  );
}
