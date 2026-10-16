// Splits a content file into its leading YAML frontmatter block and Markdown
// body. Replaces gray-matter, whose js-yaml 3 dependency chain pulled in
// unpatchable runtime packages. It gives the same result as gray-matter 4 on
// well-formed files (see lib/__tests__/frontmatter.test.ts) and throws where
// gray-matter guessed: a malformed opening line (including gray-matter's
// "---js", which it eval'ed), a missing or malformed closing line, or a
// non-mapping block.
//
// Unquoted timestamps still load as Date, as they did with gray-matter; the
// pipeline quotes its dates. js-yaml 4 resolves other plain scalars by YAML
// 1.2 rules where js-yaml 3 used YAML 1.1. Of the values PyYAML's safe_dump
// leaves unquoted, only a whole value like 0o17 changes (number, not string);
// hand-written YAML can also differ (017 is 17, not octal 15; 1:30 is a string).
import { load } from "js-yaml";

export interface ParsedFrontmatter<T> {
  data: T;
  content: string;
}

const OPEN = /^---[ \t]*\r?\n/;
// The first line that starts with --- closes the block, as in gray-matter;
// anything but spaces after it is an error rather than stray body text.
const CLOSE = /\r?\n---([^\r\n]*)(?:\r?\n|$)/;

// The type parameter is not checked: callers name the shape they expect, as
// they did with gray-matter's untyped data. Field validation is the
// pipeline's job (src/pipeline/domain/).
export function parseFrontmatter<T extends object = Record<string, unknown>>(
  input: string,
): ParsedFrontmatter<T> {
  const raw = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  // "----" or more opens no frontmatter (a Markdown rule), as in gray-matter.
  if (!raw.startsWith("---") || raw[3] === "-") return { data: {} as T, content: raw };
  if (!OPEN.test(raw)) {
    throw new Error("Frontmatter opening line must be exactly --- (no language tag or text)");
  }

  // Search from just after the opening "---" so an empty block ("---\n---")
  // closes on the opening line's own newline, as gray-matter does.
  const rest = raw.slice(3);
  const close = CLOSE.exec(rest);
  if (!close) throw new Error("Frontmatter has no closing --- line");
  if (close[1].trim() !== "") {
    throw new Error("Frontmatter closing line must be exactly --- (no other text)");
  }
  // js-yaml 4 `load` uses the safe default schema; an empty block loads as undefined.
  const data = load(rest.slice(0, close.index)) ?? {};
  if (Object.getPrototypeOf(data) !== Object.prototype) {
    throw new Error("Frontmatter must be a YAML mapping of fields");
  }
  return { data: data as T, content: rest.slice(close.index + close[0].length) };
}
