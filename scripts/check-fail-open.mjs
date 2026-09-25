#!/usr/bin/env node
/**
 * Garde anti fail-open sur les workflows. Voir `scripts/fail-open.mjs` pour le motif et
 * les cinq formes cherchées.
 *
 * Les exemptions de `scripts/fail-open-allowlist.json` sont appariées par
 * (fichier, extrait) — le CONTENU de la ligne, pas son numéro.
 *
 * L'extrait en fait partie exprès : si la ligne change de contenu, l'exemption cesse de
 * s'appliquer et la décision est à reprendre. Une exemption qui suivrait n'importe quel
 * contenu à un numéro donné serait une désactivation permanente.
 *
 * Le NUMÉRO, lui, n'en fait pas partie, et c'est une correction : la première version
 * l'incluait, et câbler ce garde dans `ci-pr.yml` de dashboard-node a décalé de six
 * lignes la ligne exemptée — l'exemption est devenue orpheline et le constat est
 * réapparu, sans que rien n'ait changé de sens. Un déplacement ne porte aucune
 * information ; un changement de contenu, oui.
 *
 * `occurrences` (1 par défaut) ferme le trou du seul appariement par contenu : si la même
 * ligne apparaît plus de fois que l'exemption ne l'annonce, le garde échoue au lieu de
 * couvrir la nouvelle.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyserDepot } from "./fail-open.mjs";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FICHIER_EXEMPTIONS = path.join(
  RACINE,
  "scripts",
  "fail-open-allowlist.json",
);

const exemptions = JSON.parse(
  readFileSync(FICHIER_EXEMPTIONS, "utf8"),
).exemptions;
const cle = (e) => `${e.fichier}\u0000${e.extrait}`;
const exemptees = new Map(exemptions.map((e) => [cle(e), e]));

const constats = analyserDepot(RACINE);
const compte = new Map();
for (const c of constats) {
  compte.set(cle(c), (compte.get(cle(c)) ?? 0) + 1);
}

// Une exemption couvre `occurrences` lignes identiques, pas plus : au-dela, la nouvelle
// occurrence n'a jamais ete decidee et doit ressortir.
const couverte = (c) => {
  const e = exemptees.get(cle(c));
  return e !== undefined && compte.get(cle(c)) <= (e.occurrences ?? 1);
};

const retenus = constats.filter((c) => !couverte(c));
const assumes = constats.filter((c) => couverte(c));

if (assumes.length > 0) {
  console.log(`Fail-open ASSUMÉS (${assumes.length}) :`);
  for (const c of assumes) {
    const e = exemptees.get(cle(c));
    console.log(
      `  .github/workflows/${c.fichier}:${c.ligne} — ${e.raison} (${e.date})`,
    );
  }
  console.log();
}

// Une exemption qui ne correspond plus à rien est du bruit qui finit par couvrir un vrai
// défaut : on la signale, sans faire échouer le garde pour autant.
const orphelines = exemptions.filter((e) => !compte.has(cle(e)));
if (orphelines.length > 0) {
  console.log(
    `⚠ ${orphelines.length} exemption(s) ne correspondent plus à rien — à retirer :`,
  );
  for (const e of orphelines) console.log(`  ${e.fichier} — ${e.extrait}`);
  console.log();
}

if (retenus.length > 0) {
  console.error(`✖ ${retenus.length} garde(s) qui échouent en vert\n`);
  for (const c of retenus) {
    console.error(`  .github/workflows/${c.fichier}:${c.ligne}`);
    console.error(`    ${c.extrait}`);
    console.error(`    motif  : ${c.motif}`);
    console.error(`    remède : ${c.remede}\n`);
  }
  console.error(
    "Corriger, ou assumer l'exemption dans scripts/fail-open-allowlist.json avec sa raison et sa date.",
  );
  process.exit(1);
}

console.log(
  `✅ Aucun fail-open non assumé dans les workflows (${assumes.length} exemption(s) active(s)).`,
);
