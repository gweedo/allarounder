import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import MarkdownEditor, { insertWrap, insertLinePrefix } from "../MarkdownEditor";

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
