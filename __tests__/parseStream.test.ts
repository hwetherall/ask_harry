import { describe, it, expect } from "vitest";
import { parseStream, FOLLOWUPS_SENTINEL } from "../lib/parseStream";

describe("parseStream", () => {
  it("returns answer-only when sentinel is absent (model forgot)", () => {
    const result = parseStream("Harry loves cooking. He bakes bread weekly.");
    expect(result.answer).toBe("Harry loves cooking. He bakes bread weekly.");
    expect(result.followups).toEqual([]);
  });

  it("splits correctly when sentinel is present", () => {
    const text = `Harry's biggest interests are cooking, family, and football.\n${FOLLOWUPS_SENTINEL}\n- What does he cook most often?\n- Which football team does he support?\n- How often does he travel?`;
    const result = parseStream(text);
    expect(result.answer).toBe(
      "Harry's biggest interests are cooking, family, and football.",
    );
    expect(result.followups).toEqual([
      "What does he cook most often?",
      "Which football team does he support?",
      "How often does he travel?",
    ]);
  });

  it("handles malformed bullets after sentinel gracefully", () => {
    const text = `Some answer.\n${FOLLOWUPS_SENTINEL}\nNot a bullet\n  *  Mixed bullet\n- normal bullet\n\n`;
    const result = parseStream(text);
    expect(result.answer).toBe("Some answer.");
    expect(result.followups).toEqual([
      "Not a bullet",
      "Mixed bullet",
      "normal bullet",
    ]);
  });

  it("caps follow-ups at 3 even if the model emits more", () => {
    const text = `Answer.\n${FOLLOWUPS_SENTINEL}\n- one\n- two\n- three\n- four\n- five`;
    const result = parseStream(text);
    expect(result.followups).toHaveLength(3);
    expect(result.followups).toEqual(["one", "two", "three"]);
  });

  it("works when the sentinel appears with no follow-ups after it", () => {
    const text = `Answer body.\n${FOLLOWUPS_SENTINEL}\n`;
    const result = parseStream(text);
    expect(result.answer).toBe("Answer body.");
    expect(result.followups).toEqual([]);
  });

  it("returns an empty answer cleanly when input is whitespace only", () => {
    expect(parseStream("")).toEqual({ answer: "", followups: [] });
    expect(parseStream("   \n\n  ")).toEqual({ answer: "", followups: [] });
  });
});
