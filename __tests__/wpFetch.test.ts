import { describe, it, expect, vi } from "vitest";
import { fetchPage, WpFetchError } from "../lib/wpFetch";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function htmlResponse(): Response {
  return new Response("<html><body>REST disabled</body></html>", {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function errorResponse(status: number): Response {
  return new Response("server boom", {
    status,
    statusText: "Server Error",
    headers: { "content-type": "text/plain" },
  });
}

describe("fetchPage retry-with-backoff", () => {
  it("retries 3 times on 5xx then throws a clear WpFetchError", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(errorResponse(503));
    const sleeper = vi.fn().mockResolvedValue(undefined);
    const waits: number[] = [];

    await expect(
      fetchPage("https://example.com/posts", {
        fetcher,
        sleeper: (ms) => {
          waits.push(ms);
          return sleeper(ms);
        },
      }),
    ).rejects.toBeInstanceOf(WpFetchError);

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(waits).toEqual([500, 1000]); // exponential backoff between attempts
  });

  it("succeeds on the 2nd attempt if the first 5xx is transient", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(errorResponse(502))
      .mockResolvedValueOnce(jsonResponse([{ id: 1, slug: "x", date: "2024-01-01", title: { rendered: "T" }, content: { rendered: "<p>hi</p>" }, link: "u" }]));

    const result = await fetchPage("https://example.com/posts", {
      fetcher,
      sleeper: () => Promise.resolve(),
    });

    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.posts).toHaveLength(1);
    }
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("fetchPage content-type detection", () => {
  it("returns kind='html' when WP REST is disabled (response is HTML)", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(htmlResponse());
    const result = await fetchPage("https://example.com/posts", {
      fetcher,
      sleeper: () => Promise.resolve(),
    });
    expect(result.kind).toBe("html");
    expect(fetcher).toHaveBeenCalledTimes(1); // no retries on HTML response
  });

  it("returns kind='done' on 400 (WP REST convention for past last page)", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('{"code":"rest_post_invalid_page_number"}', {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
      );
    const result = await fetchPage("https://example.com/posts?page=99", {
      fetcher,
      sleeper: () => Promise.resolve(),
    });
    expect(result.kind).toBe("done");
  });

  it("returns kind='done' on empty 200 array", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse([]));
    const result = await fetchPage("https://example.com/posts", {
      fetcher,
      sleeper: () => Promise.resolve(),
    });
    expect(result.kind).toBe("done");
  });
});
