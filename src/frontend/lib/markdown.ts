// Shared Markdown -> sanitized HTML pipeline.
//
// Used by both server components (article, preview, and static pages) and the
// client-side MarkdownEditor preview. Dynamic imports keep the remark/rehype
// pipeline out of the initial client bundle for the editor while server
// components can simply `await` the same function.
export async function renderMarkdown(markdown: string): Promise<string> {
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
