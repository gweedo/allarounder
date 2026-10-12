// `reading_time` is nullable in the content contract, and 0 would print a
// meaningless "0 min". Every surface that shows a reading time goes through
// this guard so they agree on when to show nothing.
export function readingMinutes(article: { reading_time: number | null }): number | null {
  const minutes = article.reading_time ?? 0;
  return minutes > 0 ? minutes : null;
}
