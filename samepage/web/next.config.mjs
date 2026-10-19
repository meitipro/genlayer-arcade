import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();
const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * A static export: there is no server, so no key can live on one. Every read
 * and write happens in the visitor's browser against Studio Next. /p/<id> and
 * /p/<id>/record are rewrites to /p and /record (vercel.json, serve.json).
 *
 * The root is pinned to this folder because the repository around it is
 * another Next.js app with its own middleware.
 */
/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  reactStrictMode: true,
  turbopack: { root: here },
  images: { unoptimized: true },
};

export default withMDX(config);
