import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const forbiddenPatterns = [
  {
    label: "live key",
    pattern: /ck_live_[A-Za-z0-9_-]*/g,
  },
];

function runGit(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

const repoFiles = [...new Set([
  ...runGit(["ls-files", "--", "app", "src", ".github/workflows", "scripts", ".env.example", "package.json", "next.config.ts"]),
  ...runGit(["ls-files", "--others", "--exclude-standard", "--", "app", "src", ".github/workflows", "scripts", ".env.example", "package.json", "next.config.ts"]),
])].filter((filePath) => filePath !== "scripts/check-sandbox-only.mjs");

const violations = [];

for (const filePath of repoFiles) {
  const content = readFileSync(filePath, "utf8");
  for (const { label, pattern } of forbiddenPatterns) {
    const match = content.match(pattern);
    if (match) {
      violations.push({ filePath, label, match: match[0] });
    }
  }
}

if (violations.length > 0) {
  const lines = [
    "Sandbox-only guard failed: forbidden production markers detected.",
    ...violations.map((violation) => `- ${violation.filePath}: ${violation.label} -> ${violation.match}`),
    "This app must remain limited to ck_demo_* flows.",
  ];
  process.stderr.write(`${lines.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write("Sandbox-only guard passed: no live markers detected in executable app, config, script or workflow files.\n");