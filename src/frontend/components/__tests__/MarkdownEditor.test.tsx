import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import MarkdownEditor, {
  insertWrap,
  insertLinePrefix,
  insertText,
} from "../MarkdownEditor";
import { importExternalImage } from "../../lib/upload";

// Mock the dynamic remark pipeline used for preview
vi.mock("remark", () => ({
  remark: () => ({
    use: () => ({
      use: () => ({
        use: () => ({
          process: vi.fn().mockResolvedValue({ toString: () => "<p>preview</p>" }),
        }),
      }),
    }),
  }),
}));
vi.mock("remark-rehype", () => ({ default: vi.fn() }));
vi.mock("rehype-sanitize", () => ({ default: vi.fn() }));
vi.mock("rehype-stringify", () => ({ default: vi.fn() }));

// The paste-to-image-import flow re-uploads external image URLs server-side;
// mock it so tests control success/failure without a real network call. The
// HTML -> Markdown conversion itself (lib/html-to-markdown) is exercised for
// real (it's fast and already unit-tested on its own).
vi.mock("../../lib/upload", () => ({
  importExternalImage: vi.fn(),
  UploadError: class UploadError extends Error {},
}));

/** Minimal controlled wrapper so paste-driven onChange calls flow back into `value`. */
function ControlledEditor(props: {
  initialValue?: string;
  onImportWarning?: (message: string) => void;
}) {
  const [value, setValue] = useState(props.initialValue ?? "");
  return (
    <MarkdownEditor
      value={value}
      onChange={setValue}
      onImportWarning={props.onImportWarning}
    />
  );
}

function pasteEvent(html: string, text: string): Event {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.assign(event, {
    clipboardData: {
      getData: (type: string) => (type === "text/html" ? html : text),
    },
  });
  return event;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ── Pure helper tests ─────────────────────────────────────────────────────────

describe("insertWrap", () => {
  it("wraps selected text in prefix+suffix", () => {
    const { value } = insertWrap("hello world", 0, 5, "**", "**");
    expect(value).toBe("**hello** world");
  });

  it("uses placeholder when no selection", () => {
    const { value } = insertWrap("abc", 3, 3, "_", "_");
    expect(value).toBe("abc_testo_");
  });

  it("positions cursor inside inserted text", () => {
    const { cursorStart, cursorEnd } = insertWrap("hello", 0, 5, "**", "**");
    expect(cursorStart).toBe(2);
    expect(cursorEnd).toBe(7);
  });

  it("bold: wraps in **...**", () => {
    const { value } = insertWrap("test", 0, 4, "**", "**");
    expect(value).toBe("**test**");
  });

  it("italic: wraps in _..._", () => {
    const { value } = insertWrap("test", 0, 4, "_", "_");
    expect(value).toBe("_test_");
  });

  it("link: wraps as [text](url)", () => {
    const { value } = insertWrap("test", 0, 4, "[", "](url)");
    expect(value).toBe("[test](url)");
  });

  it("link: uses placeholder when no selection", () => {
    const { value } = insertWrap("", 0, 0, "[", "](url)");
    expect(value).toBe("[testo](url)");
  });
});

describe("insertLinePrefix", () => {
  it("inserts prefix at start of line (cursor at start)", () => {
    const { value } = insertLinePrefix("hello", 0, "## ");
    expect(value).toBe("## hello");
  });

  it("inserts prefix at start of current line when cursor is mid-line", () => {
    const { value } = insertLinePrefix("hello", 3, "## ");
    expect(value).toBe("## hello");
  });

  it("inserts prefix on correct line in multiline text", () => {
    const { value } = insertLinePrefix("line1\nline2", 7, "- ");
    expect(value).toBe("line1\n- line2");
  });

  it("h2: inserts ## prefix", () => {
    const { value } = insertLinePrefix("titolo", 0, "## ");
    expect(value).toBe("## titolo");
  });

  it("h3: inserts ### prefix", () => {
    const { value } = insertLinePrefix("sottotitolo", 0, "### ");
    expect(value).toBe("### sottotitolo");
  });

  it("bullet: inserts - prefix", () => {
    const { value } = insertLinePrefix("voce", 0, "- ");
    expect(value).toBe("- voce");
  });

  it("numbered: inserts 1. prefix", () => {
    const { value } = insertLinePrefix("primo", 0, "1. ");
    expect(value).toBe("1. primo");
  });

  it("blockquote: inserts > prefix", () => {
    const { value } = insertLinePrefix("citazione", 0, "> ");
    expect(value).toBe("> citazione");
  });

  it("advances cursor by prefix length", () => {
    const { cursorStart, cursorEnd } = insertLinePrefix("abc", 2, "## ");
    expect(cursorStart).toBe(5);
    expect(cursorEnd).toBe(5);
  });
});

// ── Component rendering tests ─────────────────────────────────────────────────

describe("MarkdownEditor", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("renders toolbar and textarea", () => {
    render(<MarkdownEditor value="" onChange={vi.fn()} />);
    expect(screen.getByRole("toolbar")).toBeInTheDocument();
    expect(screen.getByLabelText(/testo markdown/i)).toBeInTheDocument();
  });

  it("renders all toolbar buttons", () => {
    render(<MarkdownEditor value="" onChange={vi.fn()} />);
    const labels = ["Bold", "Italic", "H2", "H3", "Link", "Lista", "Lista numerata", "Citazione"];
    for (const label of labels) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("does not render Immagine button when onUploadImage is not provided", () => {
    render(<MarkdownEditor value="" onChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /immagine/i })).toBeNull();
  });

  it("renders Immagine button when onUploadImage is provided", () => {
    render(<MarkdownEditor value="" onChange={vi.fn()} onUploadImage={vi.fn()} />);
    expect(screen.getByRole("button", { name: /immagine/i })).toBeInTheDocument();
  });

  it("bold button calls onChange with **text** wrapping", () => {
    const onChange = vi.fn();
    render(<MarkdownEditor value="ciao mondo" onChange={onChange} />);
    const textarea = screen.getByLabelText(/testo markdown/i) as HTMLTextAreaElement;
    textarea.selectionStart = 0;
    textarea.selectionEnd = 4;
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(onChange).toHaveBeenCalledWith("**ciao** mondo");
  });

  it("italic button calls onChange with _text_ wrapping", () => {
    const onChange = vi.fn();
    render(<MarkdownEditor value="ciao" onChange={onChange} />);
    const textarea = screen.getByLabelText(/testo markdown/i) as HTMLTextAreaElement;
    textarea.selectionStart = 0;
    textarea.selectionEnd = 4;
    fireEvent.click(screen.getByRole("button", { name: "Italic" }));
    expect(onChange).toHaveBeenCalledWith("_ciao_");
  });

  it("H2 button calls onChange with ## prefix on current line", () => {
    const onChange = vi.fn();
    render(<MarkdownEditor value="titolo" onChange={onChange} />);
    const textarea = screen.getByLabelText(/testo markdown/i) as HTMLTextAreaElement;
    textarea.selectionStart = 0;
    textarea.selectionEnd = 0;
    fireEvent.click(screen.getByRole("button", { name: "H2" }));
    expect(onChange).toHaveBeenCalledWith("## titolo");
  });

  it("Link button calls onChange with [text](url)", () => {
    const onChange = vi.fn();
    render(<MarkdownEditor value="link" onChange={onChange} />);
    const textarea = screen.getByLabelText(/testo markdown/i) as HTMLTextAreaElement;
    textarea.selectionStart = 0;
    textarea.selectionEnd = 4;
    fireEvent.click(screen.getByRole("button", { name: "Link" }));
    expect(onChange).toHaveBeenCalledWith("[link](url)");
  });

  it("preview pane updates after typing (debounced)", async () => {
    const { rerender } = render(<MarkdownEditor value="" onChange={vi.fn()} />);
    rerender(<MarkdownEditor value="# Titolo" onChange={vi.fn()} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });
    await waitFor(() => {
      expect(document.querySelector(".markdown-preview")).toBeTruthy();
    });
  });

  it("image upload button calls onUploadImage and inserts markdown image", async () => {
    const onUploadImage = vi.fn().mockResolvedValue("https://cdn.example.com/img.jpg");
    const onChange = vi.fn();
    render(
      <MarkdownEditor value="" onChange={onChange} onUploadImage={onUploadImage} />,
    );
    const fileInput = document.querySelector(
      "input[type=file]",
    ) as HTMLInputElement;
    const file = new File(["data"], "img.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => {
      expect(onUploadImage).toHaveBeenCalledWith(file);
      expect(onChange).toHaveBeenCalledWith(expect.stringContaining("https://cdn.example.com/img.jpg"));
    });
  });
});

// ── insertText pure helper ───────────────────────────────────────────────────

describe("insertText", () => {
  it("replaces the current selection with the given text", () => {
    const { value } = insertText("hello world", 0, 5, "goodbye");
    expect(value).toBe("goodbye world");
  });

  it("inserts at the cursor when start === end (no selection)", () => {
    const { value } = insertText("ab", 1, 1, "XY");
    expect(value).toBe("aXYb");
  });

  it("positions the cursor at the end of the inserted text", () => {
    const { cursorStart, cursorEnd } = insertText("hello", 0, 5, "hi");
    expect(cursorStart).toBe(2);
    expect(cursorEnd).toBe(2);
  });
});

// ── Paste-from-rich-text (Google Docs and beyond) ────────────────────────────

describe("MarkdownEditor paste handling", () => {
  beforeEach(() => {
    vi.mocked(importExternalImage).mockReset();
  });

  it("converts a text/html paste to Markdown and inserts it, replacing the selection", async () => {
    render(<ControlledEditor />);
    const textarea = screen.getByLabelText(/testo markdown/i) as HTMLTextAreaElement;
    textarea.selectionStart = 0;
    textarea.selectionEnd = 0;

    fireEvent(
      textarea,
      pasteEvent("<p>Hello <strong>world</strong></p>", "Hello world"),
    );

    await waitFor(() => {
      expect(textarea.value).toBe("Hello **world**");
    });
  });

  it("leaves a plain-text-only paste completely untouched (no preventDefault, no HTML conversion)", () => {
    render(<ControlledEditor initialValue="" />);
    const textarea = screen.getByLabelText(/testo markdown/i) as HTMLTextAreaElement;

    const event = pasteEvent("", "plain text only");
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");
    fireEvent(textarea, event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
    // The component's own onChange path was never triggered by paste; the
    // textarea's value is whatever the (untested-here) native browser paste
    // would produce, which this handler must not interfere with.
    expect(textarea.value).toBe("");
  });

  it("falls back to inserting plain text when conversion yields empty markdown", async () => {
    render(<ControlledEditor />);
    const textarea = screen.getByLabelText(/testo markdown/i) as HTMLTextAreaElement;
    textarea.selectionStart = 0;
    textarea.selectionEnd = 0;

    // A <script>-only payload converts to empty Markdown.
    fireEvent(
      textarea,
      pasteEvent("<script>alert(1)</script>", "fallback text"),
    );

    await waitFor(() => {
      expect(textarea.value).toBe("fallback text");
    });
  });

  it("rewrites a successfully-imported external image URL in place", async () => {
    vi.mocked(importExternalImage).mockResolvedValue(
      "https://cdn.allarounder.it/images/imported.png",
    );
    render(<ControlledEditor />);
    const textarea = screen.getByLabelText(/testo markdown/i) as HTMLTextAreaElement;
    textarea.selectionStart = 0;
    textarea.selectionEnd = 0;

    fireEvent(
      textarea,
      pasteEvent(
        '<p><img src="https://lh7-us.googleusercontent.com/abc"></p>',
        "",
      ),
    );

    await waitFor(() => {
      expect(textarea.value).toContain(
        "https://cdn.allarounder.it/images/imported.png",
      );
    });
    expect(textarea.value).not.toContain("googleusercontent.com");
  });

  it("shows an in-flight note while imports are running, and clears it after", async () => {
    const gate = deferred<string>();
    vi.mocked(importExternalImage).mockReturnValue(gate.promise);
    render(<ControlledEditor />);
    const textarea = screen.getByLabelText(/testo markdown/i) as HTMLTextAreaElement;
    textarea.selectionStart = 0;
    textarea.selectionEnd = 0;

    fireEvent(
      textarea,
      pasteEvent(
        '<p><img src="https://lh7-us.googleusercontent.com/abc"></p>',
        "",
      ),
    );

    await waitFor(() => {
      expect(screen.getByText(/importazione immagini/i)).toBeInTheDocument();
    });

    gate.resolve("https://cdn.allarounder.it/images/done.png");

    await waitFor(() => {
      expect(screen.queryByText(/importazione immagini/i)).toBeNull();
    });
  });

  it("surfaces an Italian warning via onImportWarning for images that fail to import, while keeping successes", async () => {
    vi.mocked(importExternalImage).mockImplementation((url: string) =>
      url.endsWith("ok")
        ? Promise.resolve("https://cdn.allarounder.it/images/ok.png")
        : Promise.reject(new Error("upstream 404")),
    );
    const onImportWarning = vi.fn();
    render(<ControlledEditor onImportWarning={onImportWarning} />);
    const textarea = screen.getByLabelText(/testo markdown/i) as HTMLTextAreaElement;
    textarea.selectionStart = 0;
    textarea.selectionEnd = 0;

    fireEvent(
      textarea,
      pasteEvent(
        '<p><img src="https://lh7-us.googleusercontent.com/ok">' +
          '<img src="https://lh7-us.googleusercontent.com/bad"></p>',
        "",
      ),
    );

    await waitFor(() => {
      expect(onImportWarning).toHaveBeenCalledWith(
        "1 immagine non importata: incolla di nuovo o caricale manualmente.",
      );
    });
    expect(textarea.value).toContain("https://cdn.allarounder.it/images/ok.png");
    expect(textarea.value).toContain("https://lh7-us.googleusercontent.com/bad");
  });
});
