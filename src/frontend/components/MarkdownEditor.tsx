"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { renderMarkdown } from "../lib/markdown";
import { convertHtmlToMarkdown } from "../lib/html-to-markdown";
import { importExternalImage } from "../lib/upload";

// ── Pure helpers (exported for unit testing) ──────────────────────────────────

export interface InsertResult {
  value: string;
  cursorStart: number;
  cursorEnd: number;
}

/** Wrap the current selection (or placeholder) with prefix+suffix. */
export function insertWrap(
  value: string,
  start: number,
  end: number,
  prefix: string,
  suffix: string,
  placeholder = "testo",
): InsertResult {
  const selected = value.slice(start, end) || placeholder;
  const before = value.slice(0, start);
  const after = value.slice(end);
  const newValue = `${before}${prefix}${selected}${suffix}${after}`;
  const cursorStart = start + prefix.length;
  const cursorEnd = cursorStart + selected.length;
  return { value: newValue, cursorStart, cursorEnd };
}

/** Insert prefix at the start of the current line. */
export function insertLinePrefix(
  value: string,
  cursorPos: number,
  prefix: string,
): InsertResult {
  const lineStart = value.lastIndexOf("\n", cursorPos - 1) + 1;
  const newValue =
    value.slice(0, lineStart) + prefix + value.slice(lineStart);
  const newCursor = cursorPos + prefix.length;
  return { value: newValue, cursorStart: newCursor, cursorEnd: newCursor };
}

/** Replace the current selection with literal text (used for paste insertion). */
export function insertText(
  value: string,
  start: number,
  end: number,
  text: string,
): InsertResult {
  const before = value.slice(0, start);
  const after = value.slice(end);
  const newValue = `${before}${text}${after}`;
  const cursor = start + text.length;
  return { value: newValue, cursorStart: cursor, cursorEnd: cursor };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  value: string;
  onChange: (value: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
  /** Called with an Italian warning message when some pasted images failed to import. */
  onImportWarning?: (message: string) => void;
}

export default function MarkdownEditor({
  value,
  onChange,
  onUploadImage,
  onImportWarning,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  const [importingImages, setImportingImages] = useState(false);
  const pendingCursor = useRef<{ start: number; end: number } | null>(null);

  // Always-current snapshot of `value`, so async paste-image import (which
  // can finish well after the paste event, and after further edits) rewrites
  // whichever text is on screen at that moment, not a stale closure.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Guards state updates from an in-flight image import racing unmount.
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Debounced live preview
  useEffect(() => {
    const id = setTimeout(() => {
      void renderMarkdown(value).then(setPreview);
    }, 300);
    return () => clearTimeout(id);
  }, [value]);

  // Restore cursor after controlled textarea update
  useLayoutEffect(() => {
    if (pendingCursor.current && textareaRef.current) {
      textareaRef.current.selectionStart = pendingCursor.current.start;
      textareaRef.current.selectionEnd = pendingCursor.current.end;
      pendingCursor.current = null;
    }
  });

  const applyInsert = useCallback(
    (result: InsertResult) => {
      // Update the ref synchronously (not just via the `value`-driven effect
      // above): a paste-driven image import calls importExternalImage right
      // after this insert, and an already-resolved mock (or a very fast real
      // response) can settle before React has re-rendered and flushed the
      // effect, which would otherwise read a stale value.
      valueRef.current = result.value;
      onChange(result.value);
      pendingCursor.current = {
        start: result.cursorStart,
        end: result.cursorEnd,
      };
      textareaRef.current?.focus();
    },
    [onChange],
  );

  function sel(): [number, number] {
    const el = textareaRef.current;
    return el ? [el.selectionStart, el.selectionEnd] : [0, 0];
  }

  const bold = () => { const [s, e] = sel(); applyInsert(insertWrap(value, s, e, "**", "**")); };
  const italic = () => { const [s, e] = sel(); applyInsert(insertWrap(value, s, e, "_", "_")); };
  const link = () => { const [s, e] = sel(); applyInsert(insertWrap(value, s, e, "[", "](url)")); };
  const h2 = () => { const [s] = sel(); applyInsert(insertLinePrefix(value, s, "## ")); };
  const h3 = () => { const [s] = sel(); applyInsert(insertLinePrefix(value, s, "### ")); };
  const bullet = () => { const [s] = sel(); applyInsert(insertLinePrefix(value, s, "- ")); };
  const numbered = () => { const [s] = sel(); applyInsert(insertLinePrefix(value, s, "1. ")); };
  const blockquote = () => { const [s] = sel(); applyInsert(insertLinePrefix(value, s, "> ")); };

  const handleImageFile = useCallback(
    async (file: File) => {
      if (!onUploadImage) return;
      try {
        const url = await onUploadImage(file);
        const [s, e] = sel();
        applyInsert(
          insertWrap(value, s, e, `![${file.name}](`, ")", url),
        );
      } catch {
        // caller handles errors
      }
    },
    [onUploadImage, value, applyInsert],
  );

  // Re-upload transient external image URLs (e.g. Google Docs'
  // lh7-us.googleusercontent.com links) left in pasted markdown, then rewrite
  // them in place once each import settles. Runs fire-and-forget so the
  // editor stays usable while imports are in flight (no blocking spinner).
  const importPastedImages = useCallback(
    async (urls: string[]) => {
      setImportingImages(true);
      const results = await Promise.allSettled(
        urls.map((url) => importExternalImage(url)),
      );
      if (!mountedRef.current) return;

      let updated = valueRef.current;
      let failures = 0;
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          updated = updated.split(urls[index]).join(result.value);
        } else {
          failures += 1;
        }
      });
      if (updated !== valueRef.current) {
        onChange(updated);
      }
      setImportingImages(false);
      if (failures > 0) {
        const noun =
          failures === 1 ? "immagine non importata" : "immagini non importate";
        onImportWarning?.(
          `${failures} ${noun}: incolla di nuovo o caricale manualmente.`,
        );
      }
    },
    [onChange, onImportWarning],
  );

  // Convert any rich-text (`text/html`) paste to Markdown matching the
  // toolbar's own conventions, rather than dumping raw HTML or Word/Docs
  // clutter into the article body. This is intentionally not limited to
  // Google Docs: rich text pasted from any source is converted. Plain-text
  // clipboard data is left completely untouched (no preventDefault) so a
  // normal text paste behaves exactly as the browser default.
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const html = e.clipboardData.getData("text/html");
      if (!html || !html.trim()) return;

      e.preventDefault();
      const plainText = e.clipboardData.getData("text/plain");
      const [start, end] = sel();

      let markdown = "";
      let externalImages: string[] = [];
      try {
        const converted = await convertHtmlToMarkdown(html);
        markdown = converted.markdown;
        externalImages = converted.externalImages;
      } catch {
        markdown = "";
      }

      if (!markdown.trim()) {
        // Conversion produced nothing usable — fall back to inserting the
        // plain-text payload ourselves (we already prevented the default).
        if (plainText) {
          applyInsert(insertText(valueRef.current, start, end, plainText));
        }
        return;
      }

      applyInsert(insertText(valueRef.current, start, end, markdown));

      if (externalImages.length > 0) {
        void importPastedImages(externalImages);
      }
    },
    [applyInsert, importPastedImages],
  );

  const toolbarBtn = (label: string, action: () => void) => (
    <button
      key={label}
      type="button"
      aria-label={label}
      onClick={action}
      style={{
        padding: "0.25rem 0.5rem",
        marginRight: "0.25rem",
        fontFamily: "monospace",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div
        role="toolbar"
        aria-label="Formattazione Markdown"
        style={{ marginBottom: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.25rem" }}
      >
        {toolbarBtn("Bold", bold)}
        {toolbarBtn("Italic", italic)}
        {toolbarBtn("H2", h2)}
        {toolbarBtn("H3", h3)}
        {toolbarBtn("Link", link)}
        {toolbarBtn("Lista", bullet)}
        {toolbarBtn("Lista numerata", numbered)}
        {toolbarBtn("Citazione", blockquote)}
        {onUploadImage && (
          <>
            <button
              type="button"
              aria-label="Immagine"
              onClick={() => imageInputRef.current?.click()}
              style={{ padding: "0.25rem 0.5rem", cursor: "pointer" }}
            >
              Immagine
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImageFile(file);
                e.target.value = "";
              }}
            />
          </>
        )}
      </div>
      {importingImages && (
        <p
          aria-live="polite"
          style={{ fontSize: "0.85rem", color: "#666", margin: "0 0 0.5rem" }}
        >
          Importazione immagini…
        </p>
      )}
      <div style={{ display: "flex", gap: "1rem" }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={(e) => void handlePaste(e)}
          rows={15}
          style={{ flex: 1, fontFamily: "monospace", padding: "0.5rem" }}
          aria-label="Testo Markdown"
        />
        <div
          className="article-body markdown-preview"
          style={{ flex: 1, padding: "0.5rem", border: "1px solid #ddd", overflowY: "auto" }}
          dangerouslySetInnerHTML={{ __html: preview }}
        />
      </div>
    </div>
  );
}
