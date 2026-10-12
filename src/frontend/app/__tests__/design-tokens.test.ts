// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Guards the brand-colour swap: every text/background token pair in
// globals.css must meet WCAG AA for normal text (4.5:1). Swapping in the real
// Double Double colour is a three-line change to the "brand swap" block, and
// this test is what refuses a colour that would make text unreadable.

const css = readFileSync(
  fileURLToPath(new URL("../globals.css", import.meta.url)),
  "utf8",
);

function rootTokens(source: string): Map<string, string> {
  const block = source.match(/^:root\s*\{([^}]*)\}/m);
  if (!block) throw new Error("globals.css has no top-level :root block");
  const tokens = new Map<string, string>();
  const withoutComments = block[1].replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [, name, value] of withoutComments.matchAll(
    /(--[\w-]+)\s*:\s*([^;]+);/g,
  )) {
    tokens.set(name, value.trim());
  }
  return tokens;
}

const tokens = rootTokens(css);

function resolveHex(name: string, seen: string[] = []): string {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`:root has no ${name} token`);
  const alias = value.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  if (alias) {
    if (seen.includes(name)) throw new Error(`${name} is a circular alias`);
    return resolveHex(alias[1], [...seen, name]);
  }
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    throw new Error(`${name} must be a hex colour, got "${value}"`);
  }
  return value;
}

function relativeLuminance(hex: string): number {
  const digits = hex.slice(1);
  const full =
    digits.length === 3 ? [...digits].map((d) => d + d).join("") : digits;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(full.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [
    relativeLuminance(resolveHex(foreground)),
    relativeLuminance(resolveHex(background)),
  ].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("design tokens", () => {
  it.each([
    ["--color-on-brand", "--color-brand"],
    ["--color-text", "--color-surface"],
    ["--color-text", "--color-bg"],
    ["--color-text-muted", "--color-surface"],
    ["--color-text-muted", "--color-bg"],
    ["--color-brand-ink", "--color-surface"],
    ["--color-brand-ink", "--color-bg"],
    ["--color-tile-text", "--color-tile"],
  ])("%s on %s meets WCAG AA (4.5:1)", (foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  // A focus ring is a non-text UI component: WCAG 1.4.11 asks for 3:1.
  it.each([["--color-surface"], ["--color-bg"]])(
    "--color-focus on %s meets WCAG non-text contrast (3:1)",
    (background) => {
      expect(contrastRatio("--color-focus", background)).toBeGreaterThanOrEqual(
        3,
      );
    },
  );

  it("aliases the accent colour to the brand ink", () => {
    expect(tokens.get("--color-accent")).toBe("var(--color-brand-ink)");
  });
});
