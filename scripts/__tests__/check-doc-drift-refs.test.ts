/**
 * Le garde doc-drift compare deux références (mode CI et pre-push depuis le 2026-09-30).
 * Avant, la CI ne lui passait aucune référence : il lisait un arbre de travail vide et se
 * déclarait toujours « skipped ». Ces cas tournent sur un dépôt git jetable.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SCRIPT = path.resolve(__dirname, "..", "check-doc-drift.mjs");
let repo = "";
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
const commit = (files: Record<string, string>, message: string) => {
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    writeFileSync(path.join(repo, file), content);
  }
  git("add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", message);
  return git("rev-parse", "HEAD");
};
const run = (...args: string[]) =>
  spawnSync("node", [SCRIPT, ...args], { cwd: repo, encoding: "utf8" });

let racine = "";
let ciSansDoc = "";
let ciAvecDoc = "";
let bumpSeul = "";

beforeAll(() => {
  repo = mkdtempSync(path.join(tmpdir(), "doc-drift-"));
  git("init", "-q");
  racine = commit({ "README.md": "x\n" }, "racine");
  ciSansDoc = commit({ ".github/dependabot.yml": "version: 2\n" }, "ci sans doc");
  ciAvecDoc = commit(
    { ".github/workflows/ci.yml": "on: push\n", "docs/runbooks/cicd-workflow.md": "# ci\n" },
    "ci avec doc",
  );
  bumpSeul = commit({ "package.json": "{}\n", "pnpm-lock.yaml": "x\n" }, "bump");
});
afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe("check-doc-drift entre deux références", () => {
  it("échoue quand .github change sans le runbook (le cas de #87 et #93)", () => {
    const r = run("--base-ref", racine, "--head-ref", ciSansDoc);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(".github/dependabot.yml");
  });

  it("passe quand le runbook change avec le workflow", () => {
    const r = run("--base-ref", ciSansDoc, "--head-ref", ciAvecDoc);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("passed");
  });

  it("ne couple plus une montée de dépendance au runbook", () => {
    const r = run("--base-ref", ciAvecDoc, "--head-ref", bumpSeul);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("skipped");
  });

  it("échoue FERMÉ sur une référence introuvable (checkout superficiel)", () => {
    const r = run("--base-ref", "0".repeat(39) + "1", "--head-ref", "HEAD");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("comparaison impossible");
  });

  it("refuse une seule référence", () => {
    expect(run("--base-ref", racine).status).toBe(1);
  });
});
