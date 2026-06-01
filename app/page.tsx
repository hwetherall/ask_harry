"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AnswerMarkdown } from "@/components/AnswerMarkdown";
import { parseStream, FOLLOWUPS_SENTINEL } from "@/lib/parseStream";
import {
  VISIBLE_MODES,
  DEFAULT_MODE,
  PERSONA_PRESETS,
  PERSONA_PRESET_ORDER,
  MAX_PERSONA_LENGTH,
  type Mode,
} from "@/lib/modes";

// Reflective by design: shallow questions ("biggest interests?") teach users to
// ask for summaries and get summaries back. These model the use case the tool is
// actually good at — perception, change over time, the non-obvious.
const EXAMPLES = [
  "What does Harry keep coming back to?",
  "How has Harry changed over the years?",
  "What does Harry write about when something's bothering him?",
];

export default function Page() {
  const [question, setQuestion] = useState("");
  const [streamedText, setStreamedText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Voice selection lives in React state only — it resets to the default on
  // reload (no storage APIs, per spec).
  const [mode, setMode] = useState<Mode>(DEFAULT_MODE);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customPersona, setCustomPersona] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // The persona actually sent to the API: a chosen preset name wins, otherwise
  // the trimmed custom text. Empty in persona mode means "nothing chosen yet".
  const effectivePersona = useMemo(() => {
    if (selectedPreset) return PERSONA_PRESETS[selectedPreset].name;
    return customPersona.trim();
  }, [selectedPreset, customPersona]);

  const personaMissing = mode === "persona" && effectivePersona.length === 0;

  const chooseMode = (next: Mode) => {
    setMode(next);
  };

  const choosePreset = (key: string) => {
    setSelectedPreset(key);
    setCustomPersona("");
  };

  const onCustomChange = (value: string) => {
    setCustomPersona(value);
    setSelectedPreset(null);
  };

  const ask = useCallback(
    async (q: string) => {
      if (!q.trim() || isLoading) return;
      if (mode === "persona" && effectivePersona.length === 0) return;
      setQuestion(q);
      setStreamedText("");
      setErrorMsg(null);
      setIsLoading(true);

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            question: q,
            mode,
            persona: mode === "persona" ? effectivePersona : undefined,
          }),
          signal: ctrl.signal,
        });

        if (!res.ok) {
          const text = await res.text();
          setErrorMsg(text || "Something went wrong.");
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setErrorMsg("No response stream.");
          return;
        }
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          setStreamedText(buffer);
        }
        buffer += decoder.decode();
        setStreamedText(buffer);
        setHasAnswered(true);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setErrorMsg("Something interrupted. Try again?");
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, mode, effectivePersona],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    ask(question);
  };

  const parsed = parseStream(streamedText);
  const showAnswer = parsed.answer.length > 0;
  const showFollowups = !isLoading && parsed.followups.length > 0;
  const visibleAnswer = streamedText.includes(FOLLOWUPS_SENTINEL)
    ? parsed.answer
    : streamedText;

  return (
    <main>
      <h1>Ask Harry</h1>
      <p className="subtitle">
        Questions about Harry, answered from his blog at{" "}
        <a href="https://harrywetherall.com">harrywetherall.com</a>.
      </p>

      <div className="mode-toggle" role="tablist" aria-label="Answer mode">
        {VISIBLE_MODES.map((m) => {
          const active = m.key === mode;
          return (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={`mode-pill${active ? " active" : ""}`}
              onClick={() => chooseMode(m.key)}
              disabled={isLoading}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {mode === "persona" && (
        <div className="persona-picker">
          <div
            className="persona-presets"
            role="group"
            aria-label="Persona presets"
          >
            {PERSONA_PRESET_ORDER.map((key) => {
              const preset = PERSONA_PRESETS[key];
              const active = selectedPreset === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  className={`persona-chip${active ? " active" : ""}`}
                  onClick={() => choosePreset(key)}
                  disabled={isLoading}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            className="persona-custom"
            value={customPersona}
            onChange={(e) => onCustomChange(e.target.value)}
            placeholder="…or make your own (e.g. a pirate)"
            maxLength={MAX_PERSONA_LENGTH}
            disabled={isLoading}
            aria-label="Custom persona"
          />
        </div>
      )}

      <form onSubmit={onSubmit}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything…"
          maxLength={500}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !question.trim() || personaMissing}
        >
          {isLoading ? "Thinking…" : "Ask"}
        </button>
      </form>

      {personaMissing && !isLoading && (
        <p className="persona-hint">Pick a persona above (or make your own).</p>
      )}

      {!hasAnswered && !isLoading && (
        <p className="cold-start-note">
          First question takes ~30s while the bot reads through ~1,000 blog
          posts. After that, answers stream instantly.
        </p>
      )}

      {!hasAnswered && !isLoading && streamedText === "" && !errorMsg && (
        <div className="examples">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => ask(ex)}>
              {ex}
            </button>
          ))}
        </div>
      )}

      {errorMsg ? (
        <div className="answer error">{errorMsg}</div>
      ) : showAnswer || isLoading ? (
        <div className="answer">
          {visibleAnswer ? (
            <AnswerMarkdown text={visibleAnswer} />
          ) : (
            <span className="placeholder">…</span>
          )}
        </div>
      ) : null}

      {showFollowups && (
        <div className="followups">
          <div className="followups-label">You might also ask</div>
          <div className="followups-list">
            {parsed.followups.map((f) => (
              <button key={f} type="button" onClick={() => ask(f)}>
                {f}
              </button>
            ))}
          </div>
        </div>
      )}

      <footer>
        Powered by Harry&apos;s blog. Answers generated by an LLM and may be wrong.
      </footer>
    </main>
  );
}
