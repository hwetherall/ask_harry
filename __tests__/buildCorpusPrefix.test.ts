import { describe, it, expect } from "vitest";
import { buildCorpusPrefix } from "../lib/buildCorpusPrefix";
import type { Post } from "../lib/types";

const FIXTURE: Post[] = [
  {
    title: "First post",
    date: "2023-01-01",
    slug: "first",
    url: "https://example.com/first/",
    text: "Hello world.",
  },
  {
    title: "Second post",
    date: "2023-01-02",
    slug: "second",
    url: "https://example.com/second/",
    text: "Another day.\nWith two lines.",
  },
  {
    title: "Third",
    date: "2023-01-03",
    slug: "third",
    url: "https://example.com/third/",
    text: "Short one.",
  },
];

// SNAPSHOT TEST — pins the byte-exact output. If this test breaks, you have
// changed the corpus prefix format, which invalidates DeepSeek's prompt cache
// and costs ~$0.06 per uncached request until the cache warms up again.
// Update the snapshot ONLY if you intend that cost.
describe("buildCorpusPrefix", () => {
  it("produces byte-stable output for a fixed input", () => {
    const output = buildCorpusPrefix(FIXTURE);
    expect(output).toBe(
      [
        "--- BLOG POSTS ---",
        "[2023-01-01] First post",
        "Hello world.",
        "",
        "[2023-01-02] Second post",
        "Another day.",
        "With two lines.",
        "",
        "[2023-01-03] Third",
        "Short one.",
        "--- END BLOG POSTS ---",
      ].join("\n"),
    );
  });

  it("handles a single post", () => {
    const output = buildCorpusPrefix([FIXTURE[0]]);
    expect(output).toBe(
      "--- BLOG POSTS ---\n[2023-01-01] First post\nHello world.\n--- END BLOG POSTS ---",
    );
  });
});
