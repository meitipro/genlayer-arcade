import path from "node:path";
import { fileURLToPath } from "node:url";

import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();
const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // The site is self-contained in web/; pin the root so a lockfile further up never becomes it.
  turbopack: { root: here },
  outputFileTracingRoot: here,
  outputFileTracingIncludes: { "/llms-full.txt": ["./content/docs/**/*"], "/llms.txt": ["./content/docs/**/*"] },
};

export default withMDX(config);
