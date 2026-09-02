import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

loadEnv({ path: ".env" });

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const CI = Boolean(process.env.CI);
const NEXT_BIN =
  process.platform === "win32" ? ".\\node_modules\\.bin\\next.cmd" : "./node_modules/.bin/next";
// Locally the dev server is convenient (no build step, hot reload). In CI it is
// the reason the suite failed: Turbopack compiling every page on demand on a
// two-core runner produced 300 s page loads and connection resets. CI builds
// once (see .github/workflows/ci.yml) and runs the suite against `next start`.
const NEXT_SERVER_COMMAND = CI ? `${NEXT_BIN} start -p ${PORT}` : `${NEXT_BIN} dev -p ${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: 1,
  // The HTML report is what CI uploads on failure, traces included.
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "line",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    // Playwright's defaults are "no limit" for both. Against the production
    // build every page answers in well under a second, so a navigation or a
    // click that is still waiting after this long is a hidden element or a
    // hung request — and the spec should say so in seconds, not burn its whole
    // 5-minute budget twice (phase7 did exactly that on every CI run).
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    // Keep the trace of a failed FIRST attempt too: with on-first-retry, a
    // failure that does not reproduce on the retry leaves nothing to look at.
    trace: CI ? "retain-on-failure" : "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: NEXT_SERVER_COMMAND,
    url: `${BASE_URL}/login`,
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});
