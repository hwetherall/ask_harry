import type { Post } from "./types";

// DO NOT CHANGE the output format of this function.
// DeepSeek's prompt cache keys on a byte-stable prefix; any change to spacing,
// separators, or field ordering invalidates the cache and costs ~$0.06 per
// uncached request until the cache warms up again. A snapshot test in
// __tests__/buildCorpusPrefix.test.ts pins the exact output for a fixture.
export function buildCorpusPrefix(posts: readonly Post[]): string {
  const body = posts
    .map((p) => `[${p.date}] ${p.title}\n${p.text}`)
    .join("\n\n");
  return `--- BLOG POSTS ---\n${body}\n--- END BLOG POSTS ---`;
}
