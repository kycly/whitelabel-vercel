#!/usr/bin/env node
/**
 * check-doc-truth — garde-fou de VÉRACITÉ de la documentation (≠ check-doc-drift qui ne
 * vérifie que le couplage code↔doc). Confronte chaque affirmation « vérifiable mécaniquement »
 * de la doc au code réel. Conçu pour zéro faux positif : ce qui n'est pas certain n'est pas signalé.
 *
 * Couches vérifiées :
 *   1. LIENS      — tout lien markdown relatif doit pointer vers un fichier existant.
 *   2. CHEMINS    — tout chemin de fichier du dépôt cité (app/…, src/…, scripts/…) doit exister.
 *   3. SCRIPTS    — tout `pnpm <x>` / `npm run <x>` doit exister dans package.json (ou builtin pnpm).
 *   4. SYMBOLES MORTS — un symbole de code supprimé ne doit pas être AFFIRMÉ en prose active.
 *
 * Exceptions légitimes : `scripts/doc-truth-allowlist.json` (chemins illustratifs assumés).
 *
 * Sortie non nulle si au moins une ERREUR. Aucune dépendance externe.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DOC_ROOTS = ["README.md", "AGENTS.md", "docs", ".github"];
const EXCLUDED_DIRS = new Set(["work", "archive", "temp", "node_modules", "superpowers"]);

const DEAD_SYMBOLS = [];

// whitelabel-vercel : App Router à la racine (`app/`) + code applicatif dans `src/`.
const REPO_PATH_RE = /(?<![\w./-])((?:app|src|scripts|docs|\.github)\/[\w./-]+\.(?:ts|tsx|mjs|cjs|js|json|sh|ya?ml))\b/g;
const PNPM_RUN_RE = /\b(?:pnpm|npm)\s+run\s+([a-z][\w:-]*)/g;
const PNPM_NS_RE = /\bpnpm(?:\s+-s)?\s+([a-z][\w-]*:[\w:-]+)/g;
const MD_LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g;

const PNPM_BUILTINS = new Set([
  "install", "i", "add", "remove", "update", "why", "audit", "exec", "dlx", "run", "config",
  "approve-builds", "store", "list", "outdated", "dedupe", "prune", "rebuild", "link", "test", "start",
]);

const isAdr = (file) => path.relative(ROOT, file).startsWith(path.join("docs", "architecture", "decisions"));
const isHistorical = (raw) => /^---[\s\S]*?\b(?:doc_status|status):\s*(?:historical|superseded)\b[\s\S]*?---/.test(raw);

function loadAllowlist() {
  const p = path.join(ROOT, "scripts", "doc-truth-allowlist.json");
  if (!existsSync(p)) return { paths: new Set(), scripts: new Set() };
  try {
    const parsed = JSON.parse(readFileSync(p, "utf8"));
    return { paths: new Set(parsed.paths ?? []), scripts: new Set(parsed.scripts ?? []) };
  } catch {
    return { paths: new Set(), scripts: new Set() };
  }
}

function listDocs(rel) {
  const abs = path.join(ROOT, rel);
  if (!existsSync(abs)) return [];
  const st = statSync(abs);
  if (st.isFile()) return abs.endsWith(".md") ? [abs] : [];
  const out = [];
  for (const entry of readdirSync(abs)) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    out.push(...listDocs(path.join(rel, entry)));
  }
  return out;
}

const packageScripts = new Set(
  Object.keys(JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).scripts ?? {}),
);

const allow = loadAllowlist();
const findings = [];
function report(file, line, kind, msg) {
  findings.push({ file: path.relative(ROOT, file), line, kind, msg });
}

const docs = [...new Set(DOC_ROOTS.flatMap(listDocs))];

for (const file of docs) {
  const raw = readFileSync(file, "utf8");
  const lines = raw.split("\n");
  const historical = isAdr(file) || isHistorical(raw);
  const adr = historical;
  const dir = path.dirname(file);

  let inFence = false;
  lines.forEach((line, i) => {
    const lineNo = i + 1;
    if (/^\s*```/.test(line)) inFence = !inFence;
    const isBanner = /^\s*>/.test(line);

    // 1. LIENS relatifs
    for (const m of line.matchAll(MD_LINK_RE)) {
      let target = m[1].trim().split(/\s+/)[0];
      if (/^(https?:|mailto:|#)/.test(target) || target.startsWith("<")) continue;
      target = target.split("#")[0];
      if (!target) continue;
      if (adr && !target.endsWith(".md")) continue;
      const resolved = path.resolve(dir, target);
      if (!existsSync(resolved)) report(file, lineNo, "LIEN", `lien cassé → ${target}`);
    }

    // 2. CHEMINS de dépôt cités (hors ADR — journal historique)
    if (!adr) {
      for (const m of line.matchAll(REPO_PATH_RE)) {
        const rel = m[1];
        if (allow.paths.has(rel)) continue;
        if (!existsSync(path.join(ROOT, rel))) report(file, lineNo, "CHEMIN", `fichier inexistant → ${rel}`);
      }
    }

    // 3. SCRIPTS pnpm/npm (hors ADR — journal historique)
    if (!adr) {
      for (const re of [PNPM_RUN_RE, PNPM_NS_RE]) {
        for (const m of line.matchAll(re)) {
          const name = m[1];
          if (PNPM_BUILTINS.has(name) || packageScripts.has(name) || allow.scripts.has(name)) continue;
          report(file, lineNo, "SCRIPT", `script npm inexistant → ${name}`);
        }
      }
    }

    // 4. SYMBOLES MORTS affirmés en prose courante
    if (!adr && !isBanner && !inFence) {
      for (const sym of DEAD_SYMBOLS) {
        if (line.includes(sym)) report(file, lineNo, "MORT", `symbole supprimé affirmé en prose active → ${sym}`);
      }
    }
  });
}

if (findings.length === 0) {
  console.log(`✅ doc-truth : ${docs.length} documents vérifiés, aucune incohérence doc↔code.`);
  process.exit(0);
}

const byKind = findings.reduce((acc, f) => ((acc[f.kind] = (acc[f.kind] ?? 0) + 1), acc), {});
console.error(`❌ doc-truth : ${findings.length} incohérence(s) sur ${docs.length} documents.`);
console.error(`   Répartition : ${Object.entries(byKind).map(([k, n]) => `${k}=${n}`).join(", ")}\n`);
for (const f of findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
  console.error(`  [${f.kind}] ${f.file}:${f.line} — ${f.msg}`);
}
console.error(`\nCorriger, ou (chemin illustratif assumé) ajouter à scripts/doc-truth-allowlist.json.`);
process.exit(1);
