import { describe, it, expect } from "vitest";
import {
  isPersonalityKey,
  buildSystemMessage,
  PERSONALITIES,
  PERSONALITY_ORDER,
  DEFAULT_PERSONALITY,
} from "../lib/personalities";
import { FOLLOWUPS_SENTINEL } from "../lib/parseStream";

describe("isPersonalityKey", () => {
  it("accepts known keys", () => {
    expect(isPersonalityKey("about-harry")).toBe(true);
    expect(isPersonalityKey("as-harry")).toBe(true);
  });

  it("rejects unknown or non-string inputs", () => {
    expect(isPersonalityKey("unhinged-harry")).toBe(false);
    expect(isPersonalityKey("")).toBe(false);
    expect(isPersonalityKey(undefined)).toBe(false);
    expect(isPersonalityKey(null)).toBe(false);
    expect(isPersonalityKey(42)).toBe(false);
    expect(isPersonalityKey({})).toBe(false);
  });
});

describe("buildSystemMessage", () => {
  const CORPUS = "--- BLOG POSTS ---\n[2024-01-01] T\nbody\n--- END BLOG POSTS ---";

  it("places rules first, corpus second, tail third", () => {
    const msg = buildSystemMessage("about-harry", CORPUS);
    const rulesIdx = msg.indexOf(PERSONALITIES["about-harry"].rules);
    const corpusIdx = msg.indexOf(CORPUS);
    const tailIdx = msg.indexOf(FOLLOWUPS_SENTINEL);
    expect(rulesIdx).toBeGreaterThanOrEqual(0);
    expect(corpusIdx).toBeGreaterThan(rulesIdx);
    expect(tailIdx).toBeGreaterThan(corpusIdx);
  });

  it("uses different rules for different personalities", () => {
    const about = buildSystemMessage("about-harry", CORPUS);
    const as = buildSystemMessage("as-harry", CORPUS);
    expect(about).not.toBe(as);
    expect(about).toContain("Refer to him as");
    expect(as).toContain('Use "I" and "me"');
  });

  it("emits a stable byte-string for the same inputs (cache invariant)", () => {
    expect(buildSystemMessage("about-harry", CORPUS)).toBe(
      buildSystemMessage("about-harry", CORPUS),
    );
  });
});

describe("personality registry", () => {
  it("has the default key present in PERSONALITIES", () => {
    expect(PERSONALITIES[DEFAULT_PERSONALITY]).toBeDefined();
  });

  it("PERSONALITY_ORDER contains every key exactly once", () => {
    expect(PERSONALITY_ORDER.sort()).toEqual(Object.keys(PERSONALITIES).sort());
  });
});
