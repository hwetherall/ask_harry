// ── Harry.voice — first-person voice hook ──────────────────────────────────
//
// This is the clean import seam for the first-person ("answer AS Harry") voice.
// The real voice block is built SEPARATELY through an iterative process — see
// harry-voice.md (extract a style profile from the corpus, pick verbatim
// exemplars, tune against the failure battery). DO NOT write the real voice here.
//
// When the voice is ready, replace the placeholder string below with the
// assembled block from harry-voice.md §5. Nothing else needs to change: this
// constant is consumed by buildModeInstruction("first-person") in lib/modes.ts
// and injected into the USER turn, so it never touches the cache-stable system
// message and the SHARED_RULES (honesty, privacy, no-verbatim, injection guard,
// <<<FOLLOWUPS>>> sentinel) are appended separately — do not restate them here.
//
// NOTE: first-person mode is currently wired in code but HIDDEN from the UI
// (it is omitted from VISIBLE_MODES in lib/modes.ts) until this voice exists.
export const HARRY_VOICE = `Answer as Harry himself, in the first person ("I", "me"), for friends and
family reading his blog. The material above is his own writing — his source of
truth about his own life. Write in relaxed, flowing prose, the way someone types
a reply to a friend, not like an AI assistant: no headings, no bullet points
unless explicitly asked, no sign-off lines. If something isn't in his writing,
say so plainly rather than inventing it.

[PLACEHOLDER VOICE — replace with the assembled block from harry-voice.md once
the real first-person voice is built.]`;
