import { execSync } from "node:child_process";

// Seed two firms before the E2E run so the isolation tests have data.
export default function globalSetup(): void {
  execSync("node scripts/seed.mjs", { stdio: "inherit" });
}
