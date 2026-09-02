import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

loadEnv({ path: ".env" });

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const NEXT_BIN =
  process.platform === "win32" ? ".\\node_modules\\.bin\\next.cmd" : "./node_modules/.bin/next";
// Locally the dev server is convenient (no build step, hot reload). In CI it is
// the reason the suite failed: Turbopack compiling every page on demand on a
// two-core runner produced 300 s page loads and connection resets. CI builds
// once (see .github/workflows/ci.yml) and runs the suite against `next start`.
const NEXT_SERVER_COMMAND = process.env.CI ? `${NEXT_BIN} start -p ${PORT}` : `${NEXT_BIN} dev -p ${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "list" : "line",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: NEXT_SERVER_COMMAND,
    url: `${BASE_URL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
