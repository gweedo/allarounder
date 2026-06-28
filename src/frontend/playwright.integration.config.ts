import { defineConfig, devices } from "@playwright/test";
import path from "path";

export const AUTH_FILE = path.join(__dirname, "playwright/.auth/admin.json");

export default defineConfig({
  testDir: "./e2e/integration",
  // Serial execution: tests share a live database and insertion order matters.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  globalSetup: "./e2e/global-setup",
  globalTeardown: "./e2e/global-teardown",
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
