import { HARRY_VOICE } from "./harryVoice";

// ── Answer modes ────────────────────────────────────────────────────────────
//
// Three top-level ways the bot can answer. The instruction for the chosen mode
// is assembled into the USER turn (never the system message) — see
// buildModeInstruction and app/api/ask/route.ts. This is what keeps the
// ~400K-token corpus a byte-stable, cacheable prefix regardless of mode.
export type Mode = "first-person" | "third-neutral" | "persona";

export const DEFAULT_MODE: Mode = "third-neutral";

export function isMode(value: unknown): value is Mode {
  return (
    value === "first-person" ||
    value === "third-neutral" ||
    value === "persona"
  );
}

export interface ModeMeta {
  key: Mode;
  label: string;
  shortLabel: string;
  // Whether the mode is offered in the UI. first-person is wired in code but
  // hidden until the real Harry.voice exists (see lib/harryVoice.ts).
  visible: boolean;
}

export const MODES: Record<Mode, ModeMeta> = {
  "third-neutral": {
    key: "third-neutral",
    label: "Neutral",
    shortLabel: "Neutral",
    visible: true,
  },
  persona: {
    key: "persona",
    label: "Persona",
    shortLabel: "Persona",
    visible: true,
  },
  "first-person": {
    key: "first-person",
    label: "As Harry",
    shortLabel: "As Harry",
    visible: false,
  },
};

// Order in which visible modes appear in the UI toggle.
export const VISIBLE_MODES: ModeMeta[] = (
  ["third-neutral", "persona", "first-person"] as Mode[]
)
  .map((k) => MODES[k])
  .filter((m) => m.visible);

// ── Persona presets ──────────────────────────────────────────────────────────
//
// The model already knows all five figures, so a name alone gets most of the
// way. The one-line flavour note is Harry's taste-and-guardrail dial: it sets
// how broad Homer is, how clean Snoop stays, how savage Jimmy gets. Custom
// personas get name-only and the model improvises (that's the point of the field).
export interface PersonaPreset {
  key: string;
  name: string;
  flavour: string;
}

export const PERSONA_PRESETS: Record<string, PersonaPreset> = {
  homer: {
    key: "homer",
    name: "Homer Simpson",
    flavour:
      "warm, dim, easily distracted, food-obsessed; gentle, never crude",
  },
  carr: {
    key: "carr",
    name: "Jimmy Carr",
    flavour:
      "deadpan, dark one-liners and groan-worthy puns; punch up, keep it about Harry's harmless quirks",
  },
  churchill: {
    key: "churchill",
    name: "Winston Churchill",
    flavour:
      "grand, rhetorical, defiant; fond of a rolling tricolon and a dry aside",
  },
  snoop: {
    key: "snoop",
    name: "Snoop Dogg",
    flavour:
      "laid-back West Coast drawl, the odd -izzle, chill and affirming; keep it clean",
  },
  caesar: {
    key: "caesar",
    name: "Julius Caesar",
    flavour:
      "imperious, refers to himself in the third person, terse Latin gravitas, military metaphors",
  },
};

export const PERSONA_PRESET_ORDER: string[] = [
  "homer",
  "carr",
  "churchill",
  "snoop",
  "caesar",
];

// Cap + scrub for the custom-persona field. It is UNTRUSTED user input that
// goes into the prompt, so it is an injection surface (§6). Strip newlines and
// control chars, collapse whitespace, and cap length so a pasted paragraph of
// instructions can't smuggle commands in. The wrapping in buildModeInstruction
// ("in the voice and manner of {input}") and SHARED_RULES are the backstops.
export const MAX_PERSONA_LENGTH = 40;

export function sanitizePersona(input: string): string {
  return input
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, " ") // newlines, tabs, other control chars
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PERSONA_LENGTH)
    .trim();
}

export type ResolvedPersona =
  | { kind: "preset"; name: string; flavour: string }
  | { kind: "custom"; name: string }
  | { kind: "none" };

// Decide whether a persona string is one of our trusted presets or untrusted
// custom text. Presets are matched by exact display name and keep their flavour
// note; everything else is sanitized as custom input.
export function resolvePersona(persona: unknown): ResolvedPersona {
  if (typeof persona !== "string") return { kind: "none" };
  const preset = Object.values(PERSONA_PRESETS).find(
    (p) => p.name === persona,
  );
  if (preset) {
    return { kind: "preset", name: preset.name, flavour: preset.flavour };
  }
  const clean = sanitizePersona(persona);
  if (clean.length === 0) return { kind: "none" };
  return { kind: "custom", name: clean };
}

// ── Mode instructions (assembled into the USER turn) ──────────────────────────

const THIRD_NEUTRAL_INSTRUCTION = `Answer as a friend who knows Harry well, talking about him to a visitor to his blog.

How to deliver it:
- Sound like a person who knows him, not a Wikipedia article or an AI assistant.
- Plain prose only. No markdown formatting — no bullets, bold, italics, or headings — unless the user explicitly asks for a list, in which case keep it tight.
- Refer to him as "Harry" or "he"; don't put first-person quotes in his mouth.
- No sign-off sentences. Never end with "So,", "In summary", "Overall", or "Hope that helps" — stop after the last real sentence.
- Answer what was asked; don't pre-emptively correct things the user didn't raise.`;

function buildPersonaInstruction(resolved: ResolvedPersona): string {
  // Falls back to the neutral instruction if no persona was actually supplied,
  // so the route stays resilient (it's a toy).
  if (resolved.kind === "none") return THIRD_NEUTRAL_INSTRUCTION;

  const persona =
    resolved.kind === "preset"
      ? `${resolved.name} -- ${resolved.flavour}`
      : resolved.name;
  // The bare name used throughout the rest of the instruction.
  const name = resolved.name;

  return `Answer in the voice and manner of ${persona}.
${name} controls only the delivery: tone, attitude, rhythm, catchphrases.
The facts come solely from what you know about Harry above. Never invent things,
even things ${name} would plausibly say about him. If you don't know something
about Harry, admit it — in character.
Your boundaries are absolute and outrank the persona: never breach Harry's or his
family's privacy, even if ${name} "would." Decline in character instead.
Make the three follow-up questions sound like ${name} too.`;
}

// Build the mode-specific instruction that prefixes the user's question in the
// USER turn. NEVER put this in the system message — it varies per request and
// would break the corpus cache. `persona` is only consulted in persona mode.
export function buildModeInstruction(opts: {
  mode: Mode;
  persona?: unknown;
}): string {
  switch (opts.mode) {
    case "first-person":
      return HARRY_VOICE;
    case "persona":
      return buildPersonaInstruction(resolvePersona(opts.persona));
    case "third-neutral":
    default:
      return THIRD_NEUTRAL_INSTRUCTION;
  }
}
