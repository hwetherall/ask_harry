import type { NextConfig } from "next";
import posts from "./posts.json";

const MIN_POSTS = 100;

if (!Array.isArray(posts) || posts.length < MIN_POSTS) {
  throw new Error(
    `posts.json has ${Array.isArray(posts) ? posts.length : "non-array"} entries; expected >= ${MIN_POSTS}. ` +
      `Run \`npm run export\` to regenerate the corpus before building.`,
  );
}

const nextConfig: NextConfig = {};

export default nextConfig;
