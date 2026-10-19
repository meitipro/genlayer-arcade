import dns from "node:dns";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMDX } from "fumadocs-mdx/next";

// Studio's AAAA addresses time out from some hosts; Node tries IPv6 first, so
// every server read would burn ~10s and fail. Measured on Fieldwork.
dns.setDefaultResultOrder("ipv4first");

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // The site lives in web/ beside contracts/ and scripts/; trace from here, not from the repo root.
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  // tsc runs in the build; the repository root's ESLint config belongs to another app.
  eslint: { ignoreDuringBuilds: true },
  // The contract source is read by /api/contract-source at request time.
  outputFileTracingIncludes: {
    "/api/contract-source": ["./generated/unban.py"],
  },
};

export default withMDX(config);
