#!/usr/bin/env node
/**
 * check-doc-structure — garde-fou de STRUCTURE documentaire (≠ check-doc-truth qui vérifie
 * la véracité). Rend le canon d'arborescence exécutable en CI. Le canon est codé ci-dessous ;
 * les dérogations éventuelles vont dans scripts/doc-structure-allowlist.json.
 *
 * Canon whitelabel-vercel (run parité doc 2026-07-21) — adapté à la portée ratifiée :
 *   - fichiers racine requis : README.md, AGENTS.md (app privée : pas de CHANGELOG/ARCHITECTURE
 *     racine, cf. registre 02-FINDINGS écarté CHANGELOG = N/A).
 *   - docs/ : noyau requis reference, architecture{,/decisions,/data-flows}, runbooks, + index README.
 *   - data-flows/ et decisions/ uniquement sous architecture/.
 *   - ADR : NNN-*.md numérotés sans doublon, avec un statut (## Statut | front-matter status:).
 *   - aucun dossier docs/ hors {canon ∪ toléré ∪ allowlist}.
 *
 * Sortie non nulle si au moins un écart. Aucune dépendance externe.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_ROOT = ["README.md", "AGENTS.md"];
const REQUIRED_DIRS = [
  "docs",
  "docs/reference",
  "docs/architecture",
  "docs/architecture/decisions",
  "docs/architecture/data-flows",
  "docs/runbooks",
];
const REQUIRED_INDEX = [
  "docs/README.md",
  "docs/reference/README.md",
  "docs/architecture/README.md",
  "docs/architecture/data-flows/README.md",
  "docs/architecture/decisions/README.md",
  "docs/runbooks/README.md",
];
const OPTIONAL_TOP = ["explanation", "tutorials", "how-to", "components", "data-flows"];
const TOLERATED = ["superpowers"];
const ALLOWED_UNDER_ARCH = new Set(["decisions", "data-flows"]);

function loadAllowlist() {
  const p = path.join(ROOT, "scripts", "doc-structure-allowlist.json");
  if (!existsSync(p)) return { dirs: [] };
  try { return { dirs: JSON.parse(readFileSync(p, "utf8")).dirs ?? [] }; } catch { return { dirs: [] }; }
}
const allow = loadAllowlist();
const ALLOWED_TOP = new Set([...["reference", "architecture", "runbooks"], ...OPTIONAL_TOP, ...TOLERATED, ...allow.dirs]);
const SKIP = new Set([...TOLERATED, ...allow.dirs, "node_modules", "work", "archive", "temp"]);

const findings = [];
const add = (kind, msg) => findings.push({ kind, msg });
const isDir = (p) => existsSync(path.join(ROOT, p)) && statSync(path.join(ROOT, p)).isDirectory();

for (const f of REQUIRED_ROOT) if (!existsSync(path.join(ROOT, f))) add("ROOT", `fichier racine requis manquant : ${f}`);
for (const d of REQUIRED_DIRS) if (!isDir(d)) add("CORE", `dossier requis manquant : ${d}/`);
for (const idx of REQUIRED_INDEX) if (isDir(path.dirname(idx)) && !existsSync(path.join(ROOT, idx))) add("INDEX", `index manquant : ${idx}`);

if (isDir("docs")) {
  for (const e of readdirSync(path.join(ROOT, "docs"))) {
    if (!isDir(path.join("docs", e))) continue;
    if (!ALLOWED_TOP.has(e)) add("HORS-CANON", `dossier docs/ hors canon : docs/${e}/`);
  }
}
if (isDir("docs/architecture")) {
  for (const e of readdirSync(path.join(ROOT, "docs/architecture"))) {
    if (!isDir(path.join("docs/architecture", e))) continue;
    const hasReadme = existsSync(path.join(ROOT, "docs/architecture", e, "README.md"));
    if (!ALLOWED_UNDER_ARCH.has(e) && !hasReadme) add("HORS-CANON", `sous-domaine architecture/ sans README d'index : docs/architecture/${e}/`);
  }
}
function walk(rel) {
  if (!isDir(rel)) return;
  for (const e of readdirSync(path.join(ROOT, rel))) {
    const child = path.join(rel, e);
    if (!isDir(child) || SKIP.has(e)) continue;
    if ((e === "data-flows" || e === "decisions") && rel !== "docs/architecture") add("MAL-PLACÉ", `${e}/ hors architecture/ : ${child}/`);
    walk(child);
  }
}
walk("docs");

const adrDir = path.join(ROOT, "docs/architecture/decisions");
if (existsSync(adrDir)) {
  const nums = new Map();
  for (const f of readdirSync(adrDir)) {
    const m = f.match(/^(\d+)-.*\.md$/);
    if (!m) continue;
    if (nums.has(m[1])) add("ADR", `numéro d'ADR en double : ${m[1]} (${nums.get(m[1])} + ${f})`);
    else nums.set(m[1], f);
    const raw = readFileSync(path.join(adrDir, f), "utf8");
    if (!/^##\s+Statu[ts]/im.test(raw) && !/^status\s*:\s*\S/im.test(raw)) add("ADR", `ADR sans statut (## Statut ou front-matter status:) : ${f}`);
  }
}

if (findings.length === 0) {
  console.log(`✅ doc-structure : arborescence conforme au canon.`);
  process.exit(0);
}
const byKind = findings.reduce((a, f) => ((a[f.kind] = (a[f.kind] ?? 0) + 1), a), {});
console.error(`❌ doc-structure : ${findings.length} écart(s). Répartition : ${Object.entries(byKind).map(([k, n]) => `${k}=${n}`).join(", ")}\n`);
for (const f of findings) console.error(`  [${f.kind}] ${f.msg}`);
console.error(`\nCorriger, ou (dérogation assumée) ajouter le dossier à scripts/doc-structure-allowlist.json.`);
process.exit(1);
