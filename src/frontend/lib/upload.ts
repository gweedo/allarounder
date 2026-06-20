const MAX_FILE_SIZE = 10 * 1024 * 1024;

export class UploadError extends Error {}

export async function uploadImage(file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new UploadError("L'immagine è troppo grande (max 10 MB).");
  }
  const previewBytes = await file.slice(0, 512).arrayBuffer();
  const preview = btoa(String.fromCharCode(...new Uint8Array(previewBytes)));
  const sasRes = await fetch("/api/admin/media/sas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, size: file.size, preview }),
    credentials: "include",
  });
  if (!sasRes.ok) {
    const data = await sasRes.json().catch(() => ({}));
    throw new UploadError(
      (data as { detail?: string }).detail ?? "Tipo file non supportato."
    );
  }
  const { sas_url, blob_url } = (await sasRes.json()) as {
    sas_url: string;
    blob_url: string;
  };
  const uploadRes = await fetch(sas_url, {
    method: "PUT",
    headers: { "x-ms-blob-type": "BlockBlob", "Content-Type": file.type },
    body: file,
  });
  if (!uploadRes.ok) {
    throw new UploadError("Errore nel caricamento dell'immagine su Azure.");
  }
  return blob_url;
}
