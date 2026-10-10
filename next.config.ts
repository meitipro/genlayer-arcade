import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Metadata here is static, so keep it in <head> for every client instead of
  // streaming it after the Suspense boundaries on the home page.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
