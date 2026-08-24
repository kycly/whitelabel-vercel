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
 *   5. CITATIONS  — `fonction` (:N) doit pointer sur la définition ; `chemin:N` sur une ligne existante.
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

// --- Couche 5 : CITATIONS de ligne.
//
// La doc d'infrastructure cite ses fonctions bash sous la forme `nom_de_fonction` (:412).
// Ces numéros pourrissent en silence : ils ne cassent aucun lien, aucun chemin, aucun script.
// Trois PR consécutives ont eu à en corriger une cinquantaine à la main — dont certains
// faux de plusieurs centaines de lignes, et depuis longtemps. Les trois gardes doc étaient
// verts pendant tout ce temps : ils valident des CHEMINS, pas des VALEURS.
//
// Le principe de zéro faux positif est tenu par la résolution : on ne vérifie que si le nom
// cité correspond à EXACTEMENT UNE définition de fonction shell dans le dépôt. Zéro
// définition (nom hors périmètre) ou plusieurs (homonymes) → on se tait. Une citation
// non résolue n'est pas une erreur, c'est une citation sur laquelle le garde n'a rien à dire.
const CITATION_RE = /`([a-z][a-z0-9_]*)`\s*\(:(\d+)\)/g;
// Une définition de fonction bash en colonne 0. La convention du dépôt est stricte, et
// n'accepter que la colonne 0 écarte tout ce qui pourrait ressembler à un appel.
const SH_DEF_RE = /^([a-z][a-z0-9_]*)\s*\(\)\s*\{?\s*$/;

function indexShellDefinitions(rel) {
  const index = new Map();
  const walk = (dir) => {
    const abs = path.join(ROOT, dir);
    if (!existsSync(abs)) return;
    for (const entry of readdirSync(abs)) {
      if (EXCLUDED_DIRS.has(entry)) continue;
      const child = path.join(dir, entry);
      if (statSync(path.join(ROOT, child)).isDirectory()) walk(child);
      else if (entry.endsWith(".sh")) {
        readFileSync(path.join(ROOT, child), "utf8")
          .split("\n")
          .forEach((line, i) => {
            const m = line.match(SH_DEF_RE);
            if (!m) return;
            if (!index.has(m[1])) index.set(m[1], []);
            index.get(m[1]).push({ file: child, line: i + 1 });
          });
      }
    }
  };
  walk(rel);
  return index;
}

const shellDefs = indexShellDefinitions("scripts");

// --- Couche 5b : citations `chemin/fichier.ext:N`.
//
// Seconde forme de citation de ligne du corpus, et la seule présente hors de ce dépôt. Elle nomme
// son fichier, donc rien à résoudre — mais rien non plus à quoi ancrer le numéro : sans symbole
// cité, « ligne 165 » ne peut être confrontée qu'à la TAILLE du fichier. Le garde est donc borné à
// ce qu'il peut prouver : une ligne au-delà de la fin n'existe pas.
//
// C'est étroit, et ça suffit à attraper le cas réel — un fichier vidé de sa substance dont la doc
// cite encore les lignes d'avant (dashboard-node : `avenguard.api.ts:165` dans un alias de 12
// lignes). Un décalage de dix lignes lui échappe ; le prétendre serait mentir sur sa portée.
//
// Deux exclusions, pour la même raison qu'en 5a — on ne signale que ce qu'on sait établir :
//   - les noms nus (`index.ts:42`) : sans répertoire, ils désignent 17 fichiers différents ici.
//   - les chemins inexistants : ce sont des références INTER-DÉPÔTS légitimes
//     (`infrastructure-node/apps/...` cité depuis kyclink-node). L'existence des chemins de CE
//     dépôt est déjà la couche 2, avec son allowlist.
const LINE_CITATION_RE =
  /([a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)+\.(?:ts|tsx|mjs|cjs|js|sql|sh|ya?ml)):(\d+)/g;

const fileLineCounts = new Map();
function lineCountOf(rel) {
  if (fileLineCounts.has(rel)) return fileLineCounts.get(rel);
  const abs = path.join(ROOT, rel);
  const n = existsSync(abs) ? readFileSync(abs, "utf8").split("\n").length : null;
  fileLineCounts.set(rel, n);
  return n;
}

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

    // 5. CITATIONS `fonction` (:N) — le numéro doit être la ligne de définition (hors ADR)
    if (!adr) {
      for (const m of line.matchAll(CITATION_RE)) {
        const [name, cited] = [m[1], Number(m[2])];
        const defs = shellDefs.get(name);
        // Non résolu ou ambigu : le garde n'a rien à dire, et se taire vaut mieux
        // qu'un doute présenté comme une erreur.
        if (!defs || defs.length !== 1) continue;
        const def = defs[0];
        if (def.line !== cited)
          report(
            file,
            lineNo,
            "CITATION",
            `\`${name}\` (:${cited}) → la définition est ligne ${def.line} de ${def.file}`,
          );
      }
    }

    // 5b. CITATIONS `chemin:N` — la ligne doit exister dans le fichier (hors ADR)
    if (!adr) {
      for (const m of line.matchAll(LINE_CITATION_RE)) {
        const rel = m[1].replace(/^\.\//, "");
        const cited = Number(m[2]);
        const total = lineCountOf(rel);
        // Chemin inexistant : référence inter-dépôts ou illustrative — couche 2, pas ici.
        if (total === null) continue;
        if (cited > total)
          report(
            file,
            lineNo,
            "CITATION",
            `${rel}:${cited} → le fichier ne fait que ${total} ligne(s)`,
          );
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
