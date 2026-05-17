import { execFileSync } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";

const hookFiles = [".githooks/pre-commit", ".githooks/pre-push"];

if (!existsSync(".git")) {
  process.stdout.write("Skipping git hooks installation: .git directory not found.\n");
  process.exit(0);
}

for (const hookFile of hookFiles) {
  if (existsSync(hookFile)) {
    chmodSync(hookFile, 0o755);
  }
}

execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
  stdio: "ignore",
});

process.stdout.write("Configured git hooks path to .githooks.\n");