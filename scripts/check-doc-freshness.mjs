#!/usr/bin/env node
/**
 * check-doc-freshness — signal de FRAÎCHEUR (advisory, JAMAIS bloquant : exit 0).
 * Opt-in : ne vérifie que les docs portant un contrat `Documentation Sync: YYYY-MM-DD`.
 * Flague ceux dont un fichier de code CITÉ a un dernier commit git POSTÉRIEUR à cette date
 * — candidats à une revue de fond. À lancer périodiquement (`pnpm docs:freshness`), pas en CI.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOC_ROOTS = ["README.md", "AGENTS.md", "docs"];
const EXCLUDED = new Set(["work", "archive", "temp", "node_modules", "superpowers"]);
const REPO_PATH_RE = /(?<![\w./-])((?:app|src|scripts)\/[\w./-]+\.(?:ts|tsx|mjs|cjs|js))\b/g;
const SYNC_RE = /Documentation Sync:\s*(\d{4}-\d{2}-\d{2})/;

function listDocs(rel) {
  const abs = path.join(ROOT, rel);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return abs.endsWith(".md") ? [abs] : [];
  const out = [];
  for (const e of readdirSync(abs)) { if (EXCLUDED.has(e)) continue; out.push(...listDocs(path.join(rel, e))); }
  return out;
}
const gitDate = (rel) => {
  try { return execFileSync("git", ["-C", ROOT, "log", "-1", "--format=%cs", "--", rel], { encoding: "utf8" }).trim(); }
  catch { return ""; }
};

const docs = [...new Set(DOC_ROOTS.flatMap(listDocs))];
let withContract = 0;
const stale = [];
for (const file of docs) {
  const raw = readFileSync(file, "utf8");
  const m = raw.match(SYNC_RE);
  if (!m) continue;
  withContract++;
  const refs = new Set();
  for (const mm of raw.matchAll(REPO_PATH_RE)) if (existsSync(path.join(ROOT, mm[1]))) refs.add(mm[1]);
  const newer = [...refs].map((rel) => ({ rel, cd: gitDate(rel) })).filter((x) => x.cd && x.cd > m[1]);
  if (newer.length) stale.push({ doc: path.relative(ROOT, file), sync: m[1], newer });
}

if (stale.length === 0) {
  console.log(`✅ doc-freshness : ${withContract} doc(s) sous contrat, aucun code postérieur détecté.`);
  process.exit(0);
}
console.log(`ℹ️  doc-freshness (advisory) : ${stale.length}/${withContract} doc(s) sous contrat dont du code cité a changé après la date de sync — à revoir :\n`);
for (const s of stale.sort((a, b) => a.doc.localeCompare(b.doc))) {
  console.log(`  ${s.doc}  (sync ${s.sync})`);
  for (const n of s.newer.slice(0, 3)) console.log(`     ↳ ${n.rel} (${n.cd})`);
  if (s.newer.length > 3) console.log(`     ↳ … +${s.newer.length - 3}`);
}
console.log(`\nSignal de revue, non bloquant. Après revue, mettre à jour le doc + son "Documentation Sync:".`);
process.exit(0);
