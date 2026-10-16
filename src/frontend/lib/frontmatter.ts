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
// 1.2 rules where js-yaml 3 used YAML 1.1. PyYAML's safe_dump leaves values
// such as 08, 09 and 0o17 unquoted; js-yaml 3 read them as strings, js-yaml 4
// as numbers, so SCHEMA below keeps any leading-zero value a string. Hand-
// written YAML can still differ (0755 was octal 493, 1:30 was 90; both are
// now strings, and 1_000 is now a string, not 1000).
import { DEFAULT_SCHEMA, Type, load, types } from "js-yaml";

// js-yaml 4 exports its built-in types at runtime, but @types/js-yaml 4.0.9
// does not declare them.
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

// An implicit type with the same tag replaces the default int and float.
const SCHEMA = DEFAULT_SCHEMA.extend({
  implicit: [
    withoutLeadingZero("tag:yaml.org,2002:int", types.int),
    withoutLeadingZero("tag:yaml.org,2002:float", types.float),
  ],
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
  // SCHEMA extends js-yaml 4's safe default schema; an empty block loads as undefined.
  const data = load(rest.slice(0, close.index), { schema: SCHEMA }) ?? {};
  if (Object.getPrototypeOf(data) !== Object.prototype) {
    throw new Error("Frontmatter must be a YAML mapping of fields");
  }
  return { data: data as T, content: rest.slice(close.index + close[0].length) };
}
