import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@": path.resolve(__dirname, "."), "server-only": path.resolve(__dirname, "tests/web/server-only-stub.ts") } },
  test: { include: ["tests/web/**/*.test.ts"], silent: false, environment: "node" },
});
