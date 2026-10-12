import { defineConfig, devices } from "@playwright/test";

// E2E_STATIC=1 tests the static export (`npm run build` first) through a
// server that mimics Cloudflare Pages; CI uses it. The default runs against
// `next dev` for local work, which answers 500 for dynamic params missing
// from generateStaticParams and compiles routes slowly on first visit.
const staticExport = !!process.env.E2E_STATIC;
const port = staticExport ? 3100 : 3000;
const localUrl = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "html",
  use: {
    baseURL: process.env.BASE_URL ?? localUrl,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: staticExport ? "node e2e/serve-export.mjs" : "npm run dev",
    url: localUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
