import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { spawnSync, execSync } from "child_process";
import { chromium } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./test-data";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const FLAG_FILE = path.join(REPO_ROOT, ".e2e-compose-started");
const AUTH_DIR = path.join(__dirname, "../playwright/.auth");
const AUTH_FILE = path.join(AUTH_DIR, "admin.json");

async function waitForOk(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${url}`);
}

export default async function globalSetup(): Promise<void> {
  // Check if this worktree's compose project already has running containers.
  const psResult = spawnSync(
    "docker",
    ["compose", "ps", "--status", "running", "--quiet"],
    { cwd: REPO_ROOT },
  );
  const alreadyRunning = (psResult.stdout?.toString() ?? "").trim().length > 0;

  if (!alreadyRunning) {
    execSync("docker compose up -d", { cwd: REPO_ROOT, stdio: "inherit" });
    writeFileSync(FLAG_FILE, "1");
  }

  await waitForOk("http://localhost:8000/api/health", 120_000);
  await waitForOk("http://localhost:3000", 120_000);

  // Idempotent: apply any pending migrations.
  execSync("docker compose exec -T backend alembic upgrade head", {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });

  // Idempotent: create admin — ignore if the user already exists.
  const adminResult = spawnSync(
    "docker",
    [
      "compose", "exec", "-T", "backend",
      "python", "-m", "cli", "create-admin",
      "--email", ADMIN_EMAIL,
      "--password", ADMIN_PASSWORD,
    ],
    { cwd: REPO_ROOT },
  );
  const adminStderr = adminResult.stderr?.toString() ?? "";
  if (
    adminResult.status !== 0 &&
    !adminStderr.includes("duplicate") &&
    !adminStderr.includes("unique") &&
    !adminStderr.includes("already")
  ) {
    throw new Error(`create-admin failed:\n${adminStderr}`);
  }

  // Launch a headless browser to complete the login flow and persist the
  // authenticated cookie jar so test specs can start already logged in.
  mkdirSync(AUTH_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("http://localhost:3000/admin/login");
  await page.fill("#email", ADMIN_EMAIL);
  await page.fill("#password", ADMIN_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL("**/admin", { timeout: 15_000 });
  await context.storageState({ path: AUTH_FILE });
  await browser.close();
}
