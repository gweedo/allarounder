// Google Docs paste -> sanitized Markdown pipeline.
//
// Google Docs' clipboard `text/html` payload wraps the whole selection in a
// `<b style="font-weight:normal" id="docs-internal-guid-...">` element and
// represents every run of text as a `<span style="...">` carrying explicit
// font-weight/font-style (rather than semantic `<strong>`/`<em>` tags). List
// items get an extra `<p>` wrapper, and images are referenced by a transient
// `lh7-us.googleusercontent.com`-style URL that expires — those need to be
// re-uploaded to our own Blob Storage after paste (see MarkdownEditor).
//
// This module normalizes that markup (via a custom rehype plugin,
// `googleDocsCleanup`) before handing it to rehype-remark + remark-stringify,
// so paste from Google Docs produces clean Markdown matching the house style
// used by MarkdownEditor's toolbar (`-` bullets, `**bold**`, `_italic_`).
//
// Dynamic imports keep the unified/rehype/remark pipeline out of the initial
// client bundle, mirroring lib/markdown.ts.

import type { Element, Root as HastRoot, RootContent as HastNode } from "hast";

const GOOGLEUSERCONTENT_HOST = /(^|\.)googleusercontent\.com$/;

interface StyleMap {
  [prop: string]: string;
}

function parseStyle(style: string | undefined): StyleMap {
  const map: StyleMap = {};
  if (!style) return map;
  for (const decl of style.split(";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim().toLowerCase();
    if (prop) map[prop] = value;
  }
  return map;
}

function isBoldStyle(style: StyleMap): boolean {
  const fw = style["font-weight"];
  if (!fw) return false;
  if (fw === "bold") return true;
  const n = Number.parseInt(fw, 10);
  return !Number.isNaN(n) && n >= 600;
}

function isItalicStyle(style: StyleMap): boolean {
  return style["font-style"] === "italic";
}

function isGoogleDocsWrapper(node: Element): boolean {
  return (
    node.tagName === "b" &&
    typeof node.properties?.id === "string" &&
    (node.properties.id as string).startsWith("docs-internal-guid")
  );
}

/** True when a node carries no meaningful content (whitespace/&nbsp;/<br> only, no images). */
function isEmptyContent(node: HastNode): boolean {
  if (node.type === "text") {
    return node.value.replace(/ /g, "").trim() === "";
  }
  if (node.type === "element") {
    if (node.tagName === "img") return false;
    if (node.tagName === "br") return true;
    return node.children.every((child) => isEmptyContent(child as HastNode));
  }
  // comments, doctype, etc. carry no content of their own
  return true;
}

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

/** Attributes that never carry semantic meaning for Markdown output. */
function stripPresentationalAttrs(node: Element): void {
  if (!node.properties) return;
  delete node.properties.className;
  delete node.properties.style;
  delete node.properties.id;
  delete node.properties.dir;
}

interface CleanupContext {
  insideHeading: boolean;
  externalImages: string[];
}

/**
 * Recursively rebuild a hast children array, applying Google-Docs-specific
 * normalization. Returns the replacement list for `nodes` (elements may
 * unwrap to zero, one, or several nodes).
 */
function transformChildren(nodes: HastNode[], ctx: CleanupContext): HastNode[] {
  const result: HastNode[] = [];
  for (const node of nodes) {
    result.push(...transformNode(node, ctx));
  }
  return result;
}

function transformNode(node: HastNode, ctx: CleanupContext): HastNode[] {
  // Comments never carry meaning in the resulting Markdown (fixture files in
  // this repo use them for documentation; arbitrary rich-text paste sources
  // like Word could carry conditional comments) — drop them unconditionally.
  if (node.type === "comment") return [];
  if (node.type !== "element") return [node];

  // Unwrap the whole-document Google Docs wrapper — it's a <b> tag but
  // font-weight:normal means it is NOT semantic bold.
  if (isGoogleDocsWrapper(node)) {
    return transformChildren(node.children as HastNode[], ctx);
  }

  if (node.tagName === "span") {
    const style = parseStyle(String(node.properties?.style ?? ""));
    const bold = isBoldStyle(style) && !ctx.insideHeading;
    const italic = isItalicStyle(style);
    let content = transformChildren(node.children as HastNode[], ctx);
    if (bold && italic) {
      content = [
        {
          type: "element",
          tagName: "strong",
          properties: {},
          children: [
            { type: "element", tagName: "em", properties: {}, children: content },
          ],
        } as Element,
      ];
    } else if (bold) {
      content = [
        { type: "element", tagName: "strong", properties: {}, children: content } as Element,
      ];
    } else if (italic) {
      content = [
        { type: "element", tagName: "em", properties: {}, children: content } as Element,
      ];
    }
    return content;
  }

  if (node.tagName === "img") {
    const src = String(node.properties?.src ?? "");
    try {
      const host = new URL(src).host;
      if (GOOGLEUSERCONTENT_HOST.test(host)) {
        ctx.externalImages.push(src);
      }
    } catch {
      // not an absolute URL — ignore
    }
    const alt = node.properties?.alt;
    node.properties = { src: node.properties?.src, ...(alt ? { alt } : {}) };
    return [node];
  }

  if (node.tagName === "a") {
    const href = node.properties?.href;
    const children = transformChildren(node.children as HastNode[], ctx);
    node.children = children as Element["children"];
    node.properties = href ? { href } : {};
    return [node];
  }

  if (HEADING_TAGS.has(node.tagName)) {
    const children = transformChildren(node.children as HastNode[], {
      ...ctx,
      insideHeading: true,
    });
    node.children = children as Element["children"];
    stripPresentationalAttrs(node);
    return [node];
  }

  if (node.tagName === "li") {
    // Google Docs wraps each list item's text in a lone <p>, which forces
    // hast-util-to-mdast to treat the list as "spread" (blank line between
    // items). Unwrap a single <p> child so tight lists render as `- item`.
    const rawChildren = node.children as HastNode[];
    const unwrapped: HastNode[] = [];
    for (const child of rawChildren) {
      if (child.type === "element" && child.tagName === "p") {
        unwrapped.push(...(child.children as HastNode[]));
      } else {
        unwrapped.push(child);
      }
    }
    node.children = transformChildren(unwrapped, ctx) as Element["children"];
    stripPresentationalAttrs(node);
    return [node];
  }

  if (node.tagName === "p") {
    const children = transformChildren(node.children as HastNode[], ctx);
    if (children.every((child) => isEmptyContent(child))) {
      return [];
    }
    node.children = children as Element["children"];
    stripPresentationalAttrs(node);
    return [node];
  }

  // Default: recurse and strip presentational attributes only.
  node.children = transformChildren(node.children as HastNode[], ctx) as Element["children"];
  stripPresentationalAttrs(node);
  return [node];
}

/**
 * Unified (hast) plugin: normalizes Google Docs' clipboard HTML shape before
 * conversion to Markdown. Collects `<img>` src URLs hosted on
 * googleusercontent.com into `externalImages` (via the `getExternalImages`
 * callback) so the caller can re-upload them.
 */
export function googleDocsCleanup(getExternalImages: (urls: string[]) => void) {
  return function transformer(tree: HastRoot): void {
    const ctx: CleanupContext = { insideHeading: false, externalImages: [] };
    tree.children = transformChildren(tree.children as HastNode[], ctx) as HastRoot["children"];
    getExternalImages(ctx.externalImages);
  };
}

export interface ConvertResult {
  markdown: string;
  externalImages: string[];
}

/**
 * Convert pasted HTML (e.g. Google Docs clipboard `text/html`) to Markdown
 * matching MarkdownEditor's house style (`-` bullets, `**bold**`, `_italic_`).
 *
 * Any `<script>`/`<style>` content is dropped by rehype-parse's default
 * handling in hast-util-to-mdast (both are in its "ignore" list), so it never
 * reaches the resulting Markdown string.
 */
export async function convertHtmlToMarkdown(html: string): Promise<ConvertResult> {
  const { unified } = await import("unified");
  const { default: rehypeParse } = await import("rehype-parse");
  const { default: rehypeRemark } = await import("rehype-remark");
  const { default: remarkStringify } = await import("remark-stringify");

  let externalImages: string[] = [];

  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(() => googleDocsCleanup((urls) => (externalImages = urls)))
    .use(rehypeRemark)
    .use(remarkStringify, {
      bullet: "-",
      emphasis: "_",
      strong: "*",
      fences: true,
      listItemIndent: "one",
    })
    .process(html);

  const markdown = String(file).trim();
  return { markdown, externalImages };
}
