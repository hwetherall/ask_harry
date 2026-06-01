export const FOLLOWUPS_SENTINEL = "<<<FOLLOWUPS>>>";

export interface ParsedStream {
  answer: string;
  followups: string[];
}

// Pure function: given the full streamed text, split on the sentinel and parse
// follow-up bullets. Tolerant of: missing sentinel (returns answer-only),
// malformed bullets, trailing whitespace, sentinel arriving mid-token.
export function parseStream(text: string): ParsedStream {
  const idx = text.indexOf(FOLLOWUPS_SENTINEL);
  if (idx === -1) {
    return { answer: text.trim(), followups: [] };
  }
  const answer = text.slice(0, idx).trim();
  const tail = text.slice(idx + FOLLOWUPS_SENTINEL.length);
  const followups = tail
    .split("\n")
    .map((line) => line.replace(/^[\s\-*]+/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 3);
  return { answer, followups };
}
