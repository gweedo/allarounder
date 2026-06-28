import { existsSync, rmSync } from "fs";
import path from "path";
import { execSync } from "child_process";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const FLAG_FILE = path.join(REPO_ROOT, ".e2e-compose-started");

export default async function globalTeardown(): Promise<void> {
  if (existsSync(FLAG_FILE)) {
    rmSync(FLAG_FILE);
    execSync("docker compose down -v", { cwd: REPO_ROOT, stdio: "inherit" });
  }
}
