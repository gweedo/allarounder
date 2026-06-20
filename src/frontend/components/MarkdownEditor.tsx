"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

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

// ── Remark pipeline (browser-side) ───────────────────────────────────────────

async function toHtml(markdown: string): Promise<string> {
  const { remark } = await import("remark");
  const { default: remarkRehype } = await import("remark-rehype");
  const { default: rehypeSanitize } = await import("rehype-sanitize");
  const { default: rehypeStringify } = await import("rehype-stringify");
  const file = await remark()
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  value: string;
  onChange: (value: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
}

export default function MarkdownEditor({ value, onChange, onUploadImage }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  const pendingCursor = useRef<{ start: number; end: number } | null>(null);

  // Debounced live preview
  useEffect(() => {
    const id = setTimeout(() => {
      void toHtml(value).then(setPreview);
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
      <div style={{ display: "flex", gap: "1rem" }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
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
