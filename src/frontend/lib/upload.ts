import { apiFetch } from "./api";

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

/**
 * Re-upload an externally-hosted image (e.g. a transient
 * lh7-us.googleusercontent.com URL left behind by a Google Docs paste) to our
 * own Blob Storage, server-side, so the article body never links to a URL we
 * don't control. Uses apiFetch (rather than a bare fetch, unlike uploadImage
 * above) since this call can race a background paste against an expired
 * access token and should get the same silent-refresh-and-retry behavior as
 * other admin calls.
 */
export async function importExternalImage(url: string): Promise<string> {
  const res = await apiFetch("/api/admin/media/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new UploadError(
      (data as { detail?: string }).detail ?? "Impossibile importare l'immagine."
    );
  }
  const { blob_url } = (await res.json()) as { blob_url: string };
  return blob_url;
}
