"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnswerMarkdown } from "@/components/AnswerMarkdown";
import { parseStream, FOLLOWUPS_SENTINEL } from "@/lib/parseStream";
import {
  PERSONALITIES,
  PERSONALITY_ORDER,
  DEFAULT_PERSONALITY,
  isPersonalityKey,
  type PersonalityKey,
} from "@/lib/personalities";

const EXAMPLES = [
  "What are Harry's biggest interests?",
  "What has Harry been cooking lately?",
  "What's Harry been up to recently?",
];

const PERSONALITY_STORAGE_KEY = "ask-harry:personality";

export default function Page() {
  const [question, setQuestion] = useState("");
  const [streamedText, setStreamedText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [personality, setPersonality] = useState<PersonalityKey>(DEFAULT_PERSONALITY);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(PERSONALITY_STORAGE_KEY);
    if (isPersonalityKey(saved)) {
      setPersonality(saved);
    }
  }, []);

  const choosePersonality = (key: PersonalityKey) => {
    setPersonality(key);
    try {
      localStorage.setItem(PERSONALITY_STORAGE_KEY, key);
    } catch {
      // localStorage may be unavailable (private browsing); silently fall back to in-memory.
    }
  };

  const ask = useCallback(
    async (q: string) => {
      if (!q.trim() || isLoading) return;
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
          body: JSON.stringify({ question: q, personality }),
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
    [isLoading, personality],
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

      <div className="personality-toggle" role="tablist" aria-label="Voice">
        {PERSONALITY_ORDER.map((key) => {
          const p = PERSONALITIES[key];
          const active = key === personality;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              className={`personality-pill${active ? " active" : ""}`}
              onClick={() => choosePersonality(key)}
              disabled={isLoading}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={onSubmit}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything…"
          maxLength={500}
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !question.trim()}>
          {isLoading ? "Thinking…" : "Ask"}
        </button>
      </form>

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
