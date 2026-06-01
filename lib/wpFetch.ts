export interface WpPost {
  id: number;
  slug: string;
  date: string;
  title: { rendered: string };
  content: { rendered: string };
  link: string;
}

export type FetchPageResult =
  | { kind: "ok"; posts: WpPost[] }
  | { kind: "done" }
  | { kind: "html" };

export interface FetchPageDeps {
  fetcher?: typeof fetch;
  sleeper?: (ms: number) => Promise<void>;
  maxRetries?: number;
  retryBaseMs?: number;
  onRetry?: (attempt: number, error: unknown, waitMs: number) => void;
}

export class WpFetchError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "WpFetchError";
  }
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function fetchPage(
  url: string,
  deps: FetchPageDeps = {},
): Promise<FetchPageResult> {
  const fetcher = deps.fetcher ?? fetch;
  const sleeper = deps.sleeper ?? defaultSleep;
  const maxRetries = deps.maxRetries ?? 3;
  const retryBaseMs = deps.retryBaseMs ?? 500;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetcher(url);
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("text/html")) {
        return { kind: "html" };
      }
      if (res.status === 400) {
        return { kind: "done" };
      }
      if (res.status >= 500 && res.status < 600) {
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const data = (await res.json()) as WpPost[];
      if (!Array.isArray(data) || data.length === 0) {
        return { kind: "done" };
      }
      return { kind: "ok", posts: data };
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const wait = retryBaseMs * 2 ** (attempt - 1);
        deps.onRetry?.(attempt, err, wait);
        await sleeper(wait);
      }
    }
  }
  throw new WpFetchError(
    `Page failed after ${maxRetries} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
    lastError,
  );
}
