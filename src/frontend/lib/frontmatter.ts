// Splits a content file into its leading YAML frontmatter block and Markdown
// body. Replaces gray-matter, whose js-yaml 3 dependency chain pulled in
// unpatchable runtime packages; behaviour matches gray-matter 4 for the files
// the pipeline writes (see lib/__tests__/frontmatter.test.ts).
//
// js-yaml 4 resolves plain scalars by YAML 1.2 rules, gray-matter's js-yaml 3
// by YAML 1.1. Of the values PyYAML's safe_dump leaves unquoted, only a whole
// value of the form 0o17 changes: it now loads as a number, not a string.
import { load } from "js-yaml";

export interface ParsedFrontmatter<T> {
  data: T;
  content: string;
}

const OPEN = /^---[ \t]*\r?\n/;
// gray-matter read "---js" as JavaScript to eval and "---yaml" as a language
// tag; neither is supported here, and failing beats rendering YAML as body.
const LANGUAGE_OPEN = /^---[ \t]*[^\s-]/;
const CLOSE = /\r?\n---[ \t]*(?:\r?\n|$)/;

// The type parameter is not checked: callers name the shape they expect, as
// they did with gray-matter's untyped data. Field validation is the
// pipeline's job (src/pipeline/domain/).
export function parseFrontmatter<T extends object = Record<string, unknown>>(
  input: string,
): ParsedFrontmatter<T> {
  const raw = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  if (LANGUAGE_OPEN.test(raw)) {
    throw new Error("Frontmatter language tags (---js, ---yaml) are not supported");
  }
  if (!OPEN.test(raw)) return { data: {} as T, content: raw };

  // Search from just after the opening "---" so an empty block ("---\n---")
  // closes on the opening line's own newline, as gray-matter does.
  const rest = raw.slice(3);
  const close = CLOSE.exec(rest);
  const block = close ? rest.slice(0, close.index) : rest;
  // js-yaml 4 `load` uses the safe default schema; an empty block loads as undefined.
  const data = load(block) ?? {};
  if (Object.getPrototypeOf(data) !== Object.prototype) {
    throw new Error("Frontmatter must be a YAML mapping of fields");
  }
  const content = close ? rest.slice(close.index + close[0].length) : "";
  return { data: data as T, content };
}
