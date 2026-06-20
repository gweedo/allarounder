"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { uploadImage, UploadError } from "../../../../lib/upload";

const MarkdownEditor = dynamic(() => import("../../../../components/MarkdownEditor"), {
  ssr: false,
  loading: () => <textarea rows={15} style={{ width: "100%", fontFamily: "monospace" }} />,
});

interface Article {
  id: string;
  title: string;
  slug: string;
  body: string;
  status: string;
  slug_locked: boolean;
  publish_at: string | null;
  spotify_url: string | null;
  excerpt: string | null;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  reading_time: number | null;
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditArticlePage({ params }: Props) {
  const router = useRouter();
  const [articleId, setArticleId] = useState<string | null>(null);
  const [article, setArticle] = useState<Article | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImageAlt, setCoverImageAlt] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState("");
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    params.then(({ id }) => setArticleId(id));
  }, [params]);

  useEffect(() => {
    if (!articleId) return;
    fetch(`/api/admin/articles/${articleId}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Errore nel caricamento.");
        return res.json() as Promise<Article>;
      })
      .then((data) => {
        setArticle(data);
        setTitle(data.title);
        setBody(data.body);
        setSlug(data.slug);
        setExcerpt(data.excerpt ?? "");
        setSpotifyUrl(data.spotify_url ?? "");
        setCoverImageUrl(data.cover_image_url ?? "");
        setCoverImageAlt(data.cover_image_alt ?? "");
        setMetaTitle(data.meta_title ?? "");
        setMetaDescription(data.meta_description ?? "");
        setOgImageUrl(data.og_image_url ?? "");
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [articleId]);

  const handleCoverImageUpload = useCallback(async (file: File) => {
    setUploadProgress("Caricamento...");
    setError(null);
    try {
      const url = await uploadImage(file);
      setCoverImageUrl(url);
      setUploadProgress(null);
    } catch (err) {
      setError(err instanceof UploadError ? err.message : "Errore di rete durante il caricamento.");
      setUploadProgress(null);
    }
  }, []);

  const handleBodyImageUpload = useCallback(async (file: File): Promise<string> => {
    return uploadImage(file);
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!article) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/articles/${article.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          slug: article.slug_locked ? undefined : slug,
          excerpt: excerpt || undefined,
          spotify_url: spotifyUrl || undefined,
          cover_image_url: coverImageUrl || undefined,
          cover_image_alt: coverImageAlt || undefined,
          meta_title: metaTitle || undefined,
          meta_description: metaDescription || undefined,
          og_image_url: ogImageUrl || undefined,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { detail?: string }).detail ?? "Errore nel salvataggio.");
        return;
      }
      setArticle(await (res.json() as Promise<Article>));
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!article) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/articles/${article.id}/publish`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { detail?: string }).detail ?? "Errore nella pubblicazione.");
        return;
      }
      setArticle(await (res.json() as Promise<Article>));
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!article) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/articles/${article.id}/archive`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { detail?: string }).detail ?? "Errore nell'archiviazione.");
        return;
      }
      router.push("/admin/articles");
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    if (!article) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/articles/${article.id}/preview-token`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { detail?: string }).detail ?? "Errore generazione anteprima.");
        return;
      }
      const { preview_url } = (await res.json()) as { preview_url: string };
      window.open(preview_url, "_blank", "noopener,noreferrer");
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Caricamento...</p>;
  if (!article) return <p role="alert">{error ?? "Articolo non trovato."}</p>;

  return (
    <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Modifica articolo</h1>
      <p>
        Stato: <strong>{article.status}</strong>
        {article.reading_time && (
          <span style={{ marginLeft: "1rem", color: "#666" }}>
            {article.reading_time} min di lettura
          </span>
        )}
      </p>
      {error && (
        <p role="alert" style={{ color: "red" }}>
          {error}
        </p>
      )}
      <form onSubmit={handleSave}>
        <div>
          <label htmlFor="title">Titolo</label>
          <br />
          <input
            id="title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", marginTop: "0.25rem" }}
          />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label htmlFor="slug">Slug</label>
          <br />
          {article.slug_locked ? (
            <input
              id="slug"
              type="text"
              value={slug}
              readOnly
              aria-label="slug (bloccato)"
              style={{ width: "100%", marginTop: "0.25rem", background: "#eee" }}
            />
          ) : (
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              style={{ width: "100%", marginTop: "0.25rem" }}
            />
          )}
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label htmlFor="excerpt">
            Estratto ({excerpt.length}/300)
          </label>
          <br />
          <textarea
            id="excerpt"
            rows={3}
            maxLength={300}
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            style={{ width: "100%", marginTop: "0.25rem" }}
          />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label>Testo (Markdown)</label>
          <div style={{ marginTop: "0.25rem" }}>
            <MarkdownEditor
              value={body}
              onChange={setBody}
              onUploadImage={handleBodyImageUpload}
            />
          </div>
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label htmlFor="cover-image">Immagine di copertina</label>
          <br />
          <input
            id="cover-image"
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleCoverImageUpload(file);
            }}
            style={{ marginTop: "0.25rem" }}
          />
          {uploadProgress && <span style={{ marginLeft: "0.5rem" }}>{uploadProgress}</span>}
          {coverImageUrl && (
            <div style={{ marginTop: "0.5rem" }}>
              <img src={coverImageUrl} alt="Anteprima copertina" style={{ maxHeight: 120 }} />
            </div>
          )}
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label htmlFor="cover-alt">Alt testo copertina</label>
          <br />
          <input
            id="cover-alt"
            type="text"
            maxLength={160}
            value={coverImageAlt}
            onChange={(e) => setCoverImageAlt(e.target.value)}
            style={{ width: "100%", marginTop: "0.25rem" }}
          />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label htmlFor="spotify-url">URL Spotify (episodio)</label>
          <br />
          <input
            id="spotify-url"
            type="url"
            value={spotifyUrl}
            onChange={(e) => setSpotifyUrl(e.target.value)}
            placeholder="https://open.spotify.com/episode/..."
            style={{ width: "100%", marginTop: "0.25rem" }}
          />
        </div>
        <fieldset style={{ marginTop: "1.5rem", border: "1px solid #ccc", padding: "1rem" }}>
          <legend>SEO / Open Graph</legend>
          <div>
            <label htmlFor="meta-title">
              Meta titolo ({metaTitle.length}/60)
            </label>
            <br />
            <input
              id="meta-title"
              type="text"
              maxLength={60}
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              style={{ width: "100%", marginTop: "0.25rem" }}
            />
          </div>
          <div style={{ marginTop: "0.75rem" }}>
            <label htmlFor="meta-desc">
              Meta descrizione ({metaDescription.length}/160)
            </label>
            <br />
            <textarea
              id="meta-desc"
              rows={3}
              maxLength={160}
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              style={{ width: "100%", marginTop: "0.25rem" }}
            />
          </div>
          <div style={{ marginTop: "0.75rem" }}>
            <label htmlFor="og-image">OG Image URL</label>
            <br />
            <input
              id="og-image"
              type="url"
              value={ogImageUrl}
              onChange={(e) => setOgImageUrl(e.target.value)}
              style={{ width: "100%", marginTop: "0.25rem" }}
            />
          </div>
        </fieldset>
        <button type="submit" disabled={saving} style={{ marginTop: "1.5rem" }}>
          {saving ? "…" : "Salva"}
        </button>
      </form>
      <div style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}>
        {article.status === "draft" && (
          <button type="button" onClick={handlePublish} disabled={saving}>
            Pubblica
          </button>
        )}
        {article.status !== "archived" && (
          <button type="button" onClick={handleArchive} disabled={saving}>
            Archivia
          </button>
        )}
        <button type="button" onClick={handlePreview} disabled={saving}>
          Anteprima
        </button>
      </div>
    </main>
  );
}
