import { defineConfig, defineDocs } from "fumadocs-mdx/config";

export const docs = defineDocs({ dir: "content/docs" });

// "Last updated" on every page comes from git.
export default defineConfig({ lastModifiedTime: "git" });
