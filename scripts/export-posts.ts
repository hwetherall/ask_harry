import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { convert } from "html-to-text";
import { fetchPage } from "../lib/wpFetch";
import type { Post } from "../lib/types";

const WP_BASE = "https://harrywetherall.com/wp-json/wp/v2/posts";
const PER_PAGE = 100;

const root = resolve(__dirname, "..");
const postsPath = resolve(root, "posts.json");
const excludedPath = resolve(root, "excluded-slugs.json");

function loadExcludedSlugs(): Set<string> {
  if (!existsSync(excludedPath)) return new Set();
  const raw = readFileSync(excludedPath, "utf8");
  const arr = JSON.parse(raw);
  if (!Array.isArray(arr)) return new Set();
  return new Set(arr.map(String));
}

function stripHtml(html: string): string {
  return convert(html, {
    wordwrap: false,
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" },
    ],
  }).trim();
}

async function main() {
  const excluded = loadExcludedSlugs();
  const collected: Post[] = [];
  let page = 1;

  console.log(`Exporting posts from ${WP_BASE}`);
  if (excluded.size > 0) {
    console.log(`Excluding ${excluded.size} slug(s) per excluded-slugs.json`);
  }

  try {
    while (true) {
      const url = `${WP_BASE}?per_page=${PER_PAGE}&page=${page}&orderby=date&order=asc`;
      const result = await fetchPage(url, {
        onRetry: (attempt, err, wait) =>
          console.warn(
            `  page ${page} attempt ${attempt} failed: ${
              err instanceof Error ? err.message : String(err)
            } — retrying in ${wait}ms`,
          ),
      });

      if (result.kind === "html") {
        console.error(
          "\nWP REST API returned text/html — the API appears to be disabled on this host.\n" +
            "Fallback: in WordPress admin, go to Tools → Export, download the WXR XML file, " +
            "and parse that instead (see Garry.md §6 Step 1 fallback).",
        );
        process.exit(2);
      }
      if (result.kind === "done") break;

      for (const wp of result.posts) {
        if (excluded.has(wp.slug)) continue;
        const text = stripHtml(wp.content.rendered);
        if (text.length === 0) continue;
        collected.push({
          title: stripHtml(wp.title.rendered),
          date: wp.date.slice(0, 10),
          slug: wp.slug,
          url: wp.link,
          text,
        });
      }
      console.log(
        `  page ${page}: +${result.posts.length} posts (total kept: ${collected.length})`,
      );
      page++;
    }
  } catch (err) {
    console.error(
      `\nExport failed mid-pagination at page ${page}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    if (collected.length > 0) {
      const partialPath = resolve(root, "posts.partial.json");
      writeFileSync(partialPath, JSON.stringify(collected, null, 2));
      console.error(
        `Saved partial progress (${collected.length} posts) to ${partialPath}. ` +
          `Inspect, fix the cause, and re-run.`,
      );
    }
    process.exit(1);
  }

  writeFileSync(postsPath, JSON.stringify(collected, null, 2));
  console.log(`\nWrote ${collected.length} posts to ${postsPath}`);
  if (collected.length < 100) {
    console.warn(
      `WARNING: only ${collected.length} posts kept. Build assert requires >= 100. ` +
        `Check excluded-slugs.json or WP REST output.`,
    );
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
