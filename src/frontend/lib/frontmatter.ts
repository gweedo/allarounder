// Splits a content file into its leading YAML frontmatter block and Markdown
// body. Replaces gray-matter, whose js-yaml 3 dependency chain pulled in
// unpatchable runtime packages. Results match gray-matter 4 (pinned by the
// fixtures in lib/__tests__/frontmatter.test.ts) except in these cases:
//
// - It throws where gray-matter guessed: an opening line other than --- (incl.
//   gray-matter's "---js", which it eval'ed), a missing or malformed closing
//   line, or frontmatter that is not a mapping (a scalar, list or null).
// - Untagged numbers that js-yaml 3 read as numbers now load as strings:
//   leading-zero numbers (0755 was octal 493, 007 was 7), sexagesimal (1:30
//   was 90) and underscore numbers (1_000 was 1000).
// - Explicitly tagged leading-zero ints use YAML 1.2: !!int 010 is 10, not 8.
//
// Leading-zero values stay strings on purpose: PyYAML's safe_dump leaves 08,
// 09 and 0o17 unquoted, js-yaml 3 read them as strings, and js-yaml 4 alone
// would read them as numbers. Unquoted timestamps still load as Date, as in
// gray-matter; the pipeline quotes its dates.
import { DEFAULT_SCHEMA, Type, load, types } from "js-yaml";

// js-yaml 4 exports its built-in types at runtime, but @types/js-yaml 4.0.9
// does not declare them. It is pinned exactly in package.json, so a release
// that adds `types` cannot clash with this augmentation unnoticed.
declare module "js-yaml" {
  const types: { int: Type; float: Type };
}

const LEADING_ZERO = /^[-+]?0[0-9_o]/;

// js-yaml's int or float type, except that it leaves leading-zero values as strings.
function withoutLeadingZero(tag: string, base: Type): Type {
  return new Type(tag, {
    kind: "scalar",
    resolve: (data: string) => !LEADING_ZERO.test(data) && base.resolve(data),
    construct: (data: string) => base.construct(data),
  });
}

// An implicit type with the same tag replaces the default int and float for
// untagged values. Listing the originals as explicit types keeps !!int 010
// and !!float 00.5 resolving, since an explicit tag looks up the explicit type.
const SCHEMA = DEFAULT_SCHEMA.extend({
  implicit: [
    withoutLeadingZero("tag:yaml.org,2002:int", types.int),
    withoutLeadingZero("tag:yaml.org,2002:float", types.float),
  ],
  explicit: [types.int, types.float],
});

export interface ParsedFrontmatter<T> {
  data: T;
  content: string;
}

// Both delimiter lines are --- plus optional ASCII spaces or tabs.
const DELIMITER_TAIL = /^[ \t]*$/;
const OPEN = /^---[ \t]*\r?\n/;
// The first line that starts with --- closes the block, as in gray-matter;
// any other text after it is an error rather than stray body text.
const CLOSE = /\r?\n---([^\r\n]*)(?:\r?\n|\r?$)/;

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
  if (!DELIMITER_TAIL.test(close[1])) {
    throw new Error("Frontmatter closing line must be exactly --- (no other text)");
  }
  // SCHEMA extends js-yaml 4's safe default schema. An empty block loads as
  // undefined and gives {}, as in gray-matter; an explicit null is rejected.
  const loaded = load(rest.slice(0, close.index), { schema: SCHEMA });
  const data = loaded === undefined ? {} : loaded;
  if (data === null || Object.getPrototypeOf(data) !== Object.prototype) {
    throw new Error("Frontmatter must be a YAML mapping of fields");
  }
  return { data: data as T, content: rest.slice(close.index + close[0].length) };
}
