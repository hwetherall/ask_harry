export const MAX_QUESTION_LENGTH = 500;

export type ValidationResult =
  | { ok: true; question: string }
  | { ok: false; status: 400; message: string };

export function validateQuestion(input: unknown): ValidationResult {
  if (typeof input !== "string") {
    return { ok: false, status: 400, message: "Question must be a string." };
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, status: 400, message: "Question cannot be empty." };
  }
  if (trimmed.length > MAX_QUESTION_LENGTH) {
    return {
      ok: false,
      status: 400,
      message: `Question is too long (max ${MAX_QUESTION_LENGTH} characters).`,
    };
  }
  return { ok: true, question: trimmed };
}
