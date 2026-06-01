import { describe, it, expect } from "vitest";
import { validateQuestion, MAX_QUESTION_LENGTH } from "../lib/validateQuestion";

describe("validateQuestion", () => {
  it("rejects non-string input", () => {
    expect(validateQuestion(undefined)).toMatchObject({ ok: false, status: 400 });
    expect(validateQuestion(null)).toMatchObject({ ok: false, status: 400 });
    expect(validateQuestion(42)).toMatchObject({ ok: false, status: 400 });
    expect(validateQuestion({ q: "hi" })).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects empty or whitespace-only strings", () => {
    expect(validateQuestion("")).toMatchObject({ ok: false, status: 400 });
    expect(validateQuestion("   ")).toMatchObject({ ok: false, status: 400 });
    expect(validateQuestion("\n\t")).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects strings longer than the cap", () => {
    const tooLong = "a".repeat(MAX_QUESTION_LENGTH + 1);
    expect(validateQuestion(tooLong)).toMatchObject({ ok: false, status: 400 });
  });

  it("accepts a valid question and returns trimmed text", () => {
    const result = validateQuestion("  What is Harry up to?  ");
    expect(result).toEqual({ ok: true, question: "What is Harry up to?" });
  });

  it("accepts a question exactly at the cap", () => {
    const atCap = "a".repeat(MAX_QUESTION_LENGTH);
    expect(validateQuestion(atCap)).toMatchObject({ ok: true });
  });
});
