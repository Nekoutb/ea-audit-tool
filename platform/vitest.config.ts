import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Load .env so tests see DATABASE_URL / APP_DATABASE_URL.
config({ path: ".env" });

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // DB integration tests share a single Postgres instance; run serially to
    // avoid cross-test interference on shared state.
    fileParallelism: false,
  },
});
