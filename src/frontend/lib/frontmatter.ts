// Splits a content file into its leading YAML frontmatter block and Markdown
// body. Replaces gray-matter, whose js-yaml 3 dependency chain pulled in
// unpatchable runtime packages; behaviour matches gray-matter 4 for the files
// the pipeline writes (see lib/__tests__/frontmatter.test.ts).
import { load } from "js-yaml";

export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  content: string;
}

const OPEN = /^---\r?\n/;
const CLOSE = "\n---";

export function parseFrontmatter(input: string): ParsedFrontmatter {
  const raw = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  if (!OPEN.test(raw)) return { data: {}, content: raw };

  // Search from just after the opening "---" so an empty block ("---\n---")
  // closes on the opening line's newline, as gray-matter does.
  const close = raw.indexOf(CLOSE, 3);
  const end = close === -1 ? raw.length : close;
  // js-yaml 4 `load` uses the safe default schema; an empty block loads as undefined.
  const data = (load(raw.slice(3, end)) ?? {}) as Record<string, unknown>;
  const content = close === -1 ? "" : raw.slice(close + CLOSE.length).replace(/^\r?\n?/, "");
  return { data, content };
}
