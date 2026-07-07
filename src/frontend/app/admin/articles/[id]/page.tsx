"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { uploadImage, UploadError } from "../../../../lib/upload";

const MarkdownEditor = dynamic(() => import("../../../../components/MarkdownEditor"), {
  ssr: false,
  loading: () => <textarea rows={15} style={{ width: "100%", fontFamily: "monospace" }} />,
});

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Guest {
  id: string;
  name: string;
  slug: string;
}

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
  category_id: string | null;
  tags: string[];
  guest_ids: string[];
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
  const [categoryId, setCategoryId] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [guestIds, setGuestIds] = useState<string[]>([]);
  const [allGuests, setAllGuests] = useState<Guest[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [modalName, setModalName] = useState("");
  const [modalBio, setModalBio] = useState("");
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ id }) => setArticleId(id));
  }, [params]);

  useEffect(() => {
    fetch("/api/admin/categories", { credentials: "include" })
      .then((res) => (res.ok ? (res.json() as Promise<{ items: Category[] }>) : Promise.reject()))
      .then((data) => setCategories(data.items))
      .catch(() => {});
    fetch("/api/admin/guests", { credentials: "include" })
      .then((res) => (res.ok ? (res.json() as Promise<{ items: Guest[] }>) : Promise.reject()))
      .then((data) => setAllGuests(data.items))
      .catch(() => {});
  }, []);

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
        setCategoryId(data.category_id ?? "");
        setTags(data.tags ?? []);
        setGuestIds(data.guest_ids ?? []);
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
          category_id: categoryId || undefined,
          tags,
          guest_ids: guestIds,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { detail?: string }).detail ?? "Errore nel salvataggio.");
        return;
      }
      const saved = await (res.json() as Promise<Article>);
      setArticle(saved);
      setTags(saved.tags ?? []);
      setGuestIds(saved.guest_ids ?? []);
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

  async function handleCreateGuest(e: FormEvent) {
    e.preventDefault();
    setModalSaving(true);
    setModalError(null);
    try {
      const res = await fetch("/api/admin/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modalName, bio: modalBio || undefined }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setModalError((data as { detail?: string }).detail ?? "Errore nella creazione.");
        return;
      }
      const created = (await res.json()) as Guest;
      setAllGuests((prev) => [...prev, created]);
      setGuestIds((prev) => [...prev, created.id]);
      setShowGuestModal(false);
      setModalName("");
      setModalBio("");
    } catch {
      setModalError("Errore di rete. Riprova.");
    } finally {
      setModalSaving(false);
    }
  }

  if (loading) return <p>Caricamento...</p>;
  if (!article) return <p role="alert">{error ?? "Articolo non trovato."}</p>;

  return (
    <main className="page-container page-container--wide">
      <h1>Modifica articolo</h1>
      <p>
        Stato: <strong>{article.status}</strong>
        {article.reading_time && (
          <span className="article-meta" style={{ marginLeft: "1rem" }}>
            {article.reading_time} min di lettura
          </span>
        )}
      </p>
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      <form onSubmit={handleSave}>
        <div>
          <label htmlFor="title" className="label">
            Titolo
          </label>
          <input
            id="title"
            type="text"
            className="input"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label htmlFor="slug" className="label">
            Slug
          </label>
          {article.slug_locked ? (
            <input
              id="slug"
              type="text"
              className="input"
              value={slug}
              readOnly
              aria-label="slug (bloccato)"
              style={{ background: "var(--color-border)" }}
            />
          ) : (
            <input
              id="slug"
              type="text"
              className="input"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          )}
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label htmlFor="excerpt" className="label">
            Estratto ({excerpt.length}/300)
          </label>
          <textarea
            id="excerpt"
            className="input"
            rows={3}
            maxLength={300}
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
          />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label className="label">Testo (Markdown)</label>
          <MarkdownEditor
            value={body}
            onChange={setBody}
            onUploadImage={handleBodyImageUpload}
          />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label htmlFor="cover-image" className="label">
            Immagine di copertina
          </label>
          <input
            id="cover-image"
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleCoverImageUpload(file);
            }}
          />
          {uploadProgress && <span style={{ marginLeft: "0.5rem" }}>{uploadProgress}</span>}
          {coverImageUrl && (
            <div style={{ marginTop: "0.5rem" }}>
              <Image src={coverImageUrl} alt="Anteprima copertina" width={200} height={120} style={{ objectFit: "contain", maxHeight: 120 }} unoptimized />
            </div>
          )}
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label htmlFor="cover-alt" className="label">
            Alt testo copertina
          </label>
          <input
            id="cover-alt"
            type="text"
            className="input"
            maxLength={160}
            value={coverImageAlt}
            onChange={(e) => setCoverImageAlt(e.target.value)}
          />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label htmlFor="category" className="label">
            Categoria
          </label>
          <select
            id="category"
            className="input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">— Nessuna categoria —</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label htmlFor="tag-input" className="label">
            Tag
          </label>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {tags.map((tag) => (
              <span key={tag} className="badge" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                #{tag}
                <button
                  type="button"
                  aria-label={`Rimuovi tag ${tag}`}
                  onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <input
              id="tag-input"
              type="text"
              className="input"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  const name = tagInput.trim().toLowerCase();
                  if (name && !tags.includes(name)) {
                    setTags((prev) => [...prev, name]);
                  }
                  setTagInput("");
                }
              }}
              placeholder="Aggiungi tag e premi Invio"
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn"
              onClick={() => {
                const name = tagInput.trim().toLowerCase();
                if (name && !tags.includes(name)) {
                  setTags((prev) => [...prev, name]);
                }
                setTagInput("");
              }}
            >
              Aggiungi
            </button>
          </div>
        </div>
        <div style={{ marginTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label className="label">Ospiti</label>
            <button type="button" className="btn" onClick={() => setShowGuestModal(true)}>
              + Nuovo ospite
            </button>
          </div>
          {allGuests.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
              {allGuests.map((guest) => (
                <label
                  key={guest.id}
                  className="badge"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    cursor: "pointer",
                    background: guestIds.includes(guest.id) ? "var(--color-accent)" : "var(--color-border)",
                    color: guestIds.includes(guest.id) ? "#fff" : "var(--color-text)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={guestIds.includes(guest.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setGuestIds((prev) => [...prev, guest.id]);
                      } else {
                        setGuestIds((prev) => prev.filter((id) => id !== guest.id));
                      }
                    }}
                  />
                  {guest.name}
                </label>
              ))}
            </div>
          )}
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label htmlFor="spotify-url" className="label">
            URL Spotify (episodio)
          </label>
          <input
            id="spotify-url"
            type="url"
            className="input"
            value={spotifyUrl}
            onChange={(e) => setSpotifyUrl(e.target.value)}
            placeholder="https://open.spotify.com/episode/..."
          />
        </div>
        <fieldset style={{ marginTop: "1.5rem", border: "1px solid var(--color-border)", padding: "1rem", borderRadius: "var(--radius)" }}>
          <legend>SEO / Open Graph</legend>
          <div>
            <label htmlFor="meta-title" className="label">
              Meta titolo ({metaTitle.length}/60)
            </label>
            <input
              id="meta-title"
              type="text"
              className="input"
              maxLength={60}
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
            />
          </div>
          <div style={{ marginTop: "0.75rem" }}>
            <label htmlFor="meta-desc" className="label">
              Meta descrizione ({metaDescription.length}/160)
            </label>
            <textarea
              id="meta-desc"
              className="input"
              rows={3}
              maxLength={160}
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
            />
          </div>
          <div style={{ marginTop: "0.75rem" }}>
            <label htmlFor="og-image" className="label">
              OG Image URL
            </label>
            <input
              id="og-image"
              type="url"
              className="input"
              value={ogImageUrl}
              onChange={(e) => setOgImageUrl(e.target.value)}
            />
          </div>
        </fieldset>
        <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: "1.5rem" }}>
          {saving ? "…" : "Salva"}
        </button>
      </form>
      <div style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}>
        {article.status === "draft" && (
          <button type="button" className="btn" onClick={handlePublish} disabled={saving}>
            Pubblica
          </button>
        )}
        {article.status !== "archived" && (
          <button type="button" className="btn" onClick={handleArchive} disabled={saving}>
            Archivia
          </button>
        )}
        <button type="button" className="btn" onClick={handlePreview} disabled={saving}>
          Anteprima
        </button>
      </div>

      {showGuestModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="guest-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div className="card" style={{ width: "100%", maxWidth: "420px" }}>
            <h2 id="guest-modal-title" style={{ marginTop: 0 }}>Nuovo ospite</h2>
            {modalError && (
              <p role="alert" className="alert-error">
                {modalError}
              </p>
            )}
            <form onSubmit={handleCreateGuest}>
              <div>
                <label htmlFor="modal-guest-name" className="label">
                  Nome *
                </label>
                <input
                  id="modal-guest-name"
                  type="text"
                  className="input"
                  required
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                />
              </div>
              <div style={{ marginTop: "1rem" }}>
                <label htmlFor="modal-guest-bio" className="label">
                  Bio
                </label>
                <textarea
                  id="modal-guest-bio"
                  className="input"
                  rows={3}
                  value={modalBio}
                  onChange={(e) => setModalBio(e.target.value)}
                />
              </div>
              <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem" }}>
                <button type="submit" className="btn btn-primary" disabled={modalSaving}>
                  {modalSaving ? "…" : "Crea e aggiungi"}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setShowGuestModal(false);
                    setModalName("");
                    setModalBio("");
                    setModalError(null);
                  }}
                >
                  Annulla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
