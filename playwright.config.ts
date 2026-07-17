/* kxperf Discuss browser measurement rig.
   ────────────────────────────────────────────────────────────────────────────
   Purpose: measure the EXISTING Discuss client against the 5,000-message
   staging fixture, before any redesign. Not a correctness test suite.

   Deliberate choices:
   · workers: 1 — this is a benchmark. Parallel workers contend for CPU and
     turn latency percentiles into noise about the machine.
   · retries: 0 — a retried benchmark is a lie; a flaky sample must be visible.
   · trace/video/screenshot: OFF by default. The rig starts tracing MANUALLY
     after authentication (see tests/discuss/auth.ts) because Playwright traces
     record action arguments, i.e. the password.
   · webServer runs `next start` against a production build. Benchmarking a dev
     build measures the dev server, not the app. */

import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.KXPERF_PORT ?? 3021);
const BASE = process.env.KXPERF_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/discuss",
  outputDir: "./.kxperf/artifacts",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: ".kxperf/report.json" }]],
  use: {
    baseURL: BASE,
    trace: "off",        // started manually, post-auth
    video: "off",        // a video of the login form is a video of a password
    screenshot: "off",   // captured deliberately in-spec
    actionTimeout: 30_000,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: process.env.KXPERF_BASE_URL
    ? undefined            // an explicitly approved external base URL — don't start a server
    : {
        command: `npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}/api/version`,
        reuseExistingServer: true,
        timeout: 120_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});
