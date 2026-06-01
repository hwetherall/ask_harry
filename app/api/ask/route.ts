import OpenAI from "openai";
import type { APIError } from "openai";
import postsJson from "@/posts.json";
import type { Post } from "@/lib/types";
import { buildCorpusPrefix } from "@/lib/buildCorpusPrefix";
import { validateQuestion } from "@/lib/validateQuestion";
import { rateLimit } from "@/lib/rateLimit";
import { buildSystemMessage } from "@/lib/systemPrompt";
import {
  buildModeInstruction,
  resolvePersona,
  isMode,
  DEFAULT_MODE,
  type Mode,
} from "@/lib/modes";

export const runtime = "nodejs";
export const maxDuration = 90;

const posts = postsJson as Post[];
const CORPUS_PREFIX = buildCorpusPrefix(posts);

// Built once at module load and reused for every request. This is BYTE-IDENTICAL
// across all modes, personas, and users — that stability is what lets DeepSeek's
// prompt cache hit on the ~400K-token corpus every time. The variable
// mode/persona instruction lives in the user turn, never here. See
// lib/systemPrompt.ts.
const SYSTEM_MESSAGE = buildSystemMessage(CORPUS_PREFIX);

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

interface ErrorLogEntry {
  timestamp: string;
  event: "deepseek_error";
  status: number | string;
  error_class: string;
}

interface UsageLogEntry {
  timestamp: string;
  event: "deepseek_usage";
  mode: Mode;
  // Whether a persona was supplied, NOT its text — never log user input.
  persona_kind: "preset" | "custom" | "none";
  cache_hit_tokens?: number;
  cache_miss_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

function logError(entry: Omit<ErrorLogEntry, "timestamp" | "event">) {
  const out: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    event: "deepseek_error",
    ...entry,
  };
  console.error(JSON.stringify(out));
}

function logUsage(entry: Omit<UsageLogEntry, "timestamp" | "event">) {
  const out: UsageLogEntry = {
    timestamp: new Date().toISOString(),
    event: "deepseek_usage",
    ...entry,
  };
  console.log(JSON.stringify(out));
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function errorResponse(status: number, message: string) {
  const body = new TextEncoder().encode(message);
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "Request body must be valid JSON.");
  }

  const parsed = body as
    | { question?: unknown; mode?: unknown; persona?: unknown }
    | null;
  const validated = validateQuestion(parsed?.question);
  if (!validated.ok) {
    return errorResponse(validated.status, validated.message);
  }

  const mode: Mode = isMode(parsed?.mode) ? parsed.mode : DEFAULT_MODE;
  const persona = parsed?.persona;
  const persona_kind =
    mode === "persona" ? resolvePersona(persona).kind : "none";

  if (process.env.KV_REST_API_URL) {
    try {
      const rl = await rateLimit(clientIp(req));
      if (!rl.ok) {
        return errorResponse(
          429,
          "Too many questions right now, give it a second.",
        );
      }
    } catch (err) {
      logError({
        status: "rate_limit_error",
        error_class: err instanceof Error ? err.name : "Unknown",
      });
    }
  }

  // System message is the cache-stable corpus + shared rules (built once at
  // module load). The variable mode/persona instruction goes in the user turn.
  const modeInstruction = buildModeInstruction({ mode, persona });
  const userMessage = `${modeInstruction}\n\n<user_question>\n${validated.question}\n</user_question>`;

  let stream: AsyncIterable<unknown>;
  try {
    stream = await client.chat.completions.create({
      model: "deepseek-v4-flash",
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: 1500,
      messages: [
        { role: "system", content: SYSTEM_MESSAGE },
        { role: "user", content: userMessage },
      ],
    });
  } catch (err) {
    return handleDeepSeekError(err);
  }

  const encoder = new TextEncoder();
  const responseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let emitted = false;
      try {
        for await (const chunk of stream as AsyncIterable<{
          choices?: Array<{ delta?: { content?: string | null } }>;
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
            prompt_cache_hit_tokens?: number;
            prompt_cache_miss_tokens?: number;
          };
        }>) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            emitted = true;
            controller.enqueue(encoder.encode(delta));
          }
          if (chunk.usage) {
            logUsage({
              mode,
              persona_kind,
              cache_hit_tokens: chunk.usage.prompt_cache_hit_tokens,
              cache_miss_tokens: chunk.usage.prompt_cache_miss_tokens,
              completion_tokens: chunk.usage.completion_tokens,
              total_tokens: chunk.usage.total_tokens,
            });
          }
        }
        if (!emitted) {
          controller.enqueue(
            encoder.encode("I couldn't think of an answer to that."),
          );
        }
        controller.close();
      } catch (err) {
        logError({
          status: "stream_error",
          error_class: err instanceof Error ? err.name : "Unknown",
        });
        if (!emitted) {
          controller.enqueue(
            encoder.encode("Bot's having a moment, try again."),
          );
        }
        controller.close();
      }
    },
  });

  return new Response(responseStream, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function handleDeepSeekError(err: unknown): Response {
  const apiErr = err as Partial<APIError> & { name?: string; status?: number };
  const status = apiErr.status;
  const name = apiErr.name ?? "Unknown";

  logError({ status: status ?? "unknown", error_class: name });

  if (status === 401) {
    return errorResponse(500, "Bot is misconfigured. Try again later.");
  }
  if (status === 429) {
    return errorResponse(
      429,
      "Too many questions right now, give it a second.",
    );
  }
  if (name === "AbortError" || name === "APIConnectionTimeoutError") {
    return errorResponse(504, "Bot's having a moment, try again.");
  }
  if (typeof status === "number" && status >= 500 && status < 600) {
    return errorResponse(502, "Bot's having a moment, try again.");
  }
  return errorResponse(500, "Bot's having a moment, try again.");
}
