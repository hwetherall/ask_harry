import type { Post } from "./types";

// DO NOT CHANGE the output format of this function without intending to.
// DeepSeek's prompt cache keys on a byte-stable prefix; any change to spacing,
// separators, or field ordering invalidates the cache and costs ~$0.06 per
// uncached request until the cache warms up again. A snapshot test in
// __tests__/buildCorpusPrefix.test.ts pins the exact output for a fixture — if
// you change the format on purpose, update that snapshot in the same commit and
// accept the one-time cache re-warm.
//
// Posts are grouped under `=== YEAR ===` headers to make the corpus's time axis
// legible to the model (it reasons about change-over-time — see OBSERVER_STANCE
// in lib/systemPrompt.ts). This assumes posts arrive in chronological order,
// which the export guarantees; out-of-order input would repeat year headers.
export function buildCorpusPrefix(posts: readonly Post[]): string {
  let body = "";
  let currentYear = "";
  for (const p of posts) {
    const year = p.date.slice(0, 4);
    if (year !== currentYear) {
      body += `${body ? "\n\n" : ""}=== ${year} ===\n\n`;
      currentYear = year;
    } else {
      body += "\n\n";
    }
    body += `[${p.date}] ${p.title}\n${p.text}`;
  }
  return `--- BLOG POSTS ---\n${body}\n--- END BLOG POSTS ---`;
}
