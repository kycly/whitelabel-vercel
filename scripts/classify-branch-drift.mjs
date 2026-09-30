#!/usr/bin/env node
/**
 * Classe le retard d'une branche de déploiement par nature. Voir
 * `scripts/drift-classification.mjs` pour la règle et le défaut qu'elle ferme.
 *
 * Usage :
 *   node scripts/classify-branch-drift.mjs <reference> <branche>
 *   node scripts/classify-branch-drift.mjs main production
 *   node scripts/classify-branch-drift.mjs <sha-reference> <sha-branche>   # rejeu
 *
 * Sortie non nulle si le retard contient du code d'exécution. Un retard qui ne contient
 * que de la fabrication laisse le code à 0 : c'est un signalement, pas une panne.
 *
 * Demande un historique COMPLET (`fetch-depth: 0`). Un checkout superficiel donnerait un
 * diff faux, pas une erreur — c'est déjà la précondition de `branch-drift.yml`.
 */
import { execFileSync } from "node:child_process";
import {
  natureDuChemin,
  natureDuManifeste,
  classerDerive,
} from "./drift-classification.mjs";

const [, , reference, branche] = process.argv;
if (!reference || !branche) {
  console.error("usage : classify-branch-drift.mjs <reference> <branche>");
  process.exit(1);
}

const git = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();

/** Contenu d'un fichier à une révision, ou `null` s'il n'y existe pas. */
function fichierA(revision, chemin) {
  try {
    return git(["show", `${revision}:${chemin}`]);
  } catch {
    return null;
  }
}

let base;
try {
  base = git(["merge-base", branche, reference]);
} catch (erreur) {
  console.error(
    `✖ Impossible de trouver l'ancêtre commun de ${branche} et ${reference}.`,
  );
  console.error(`  ${erreur.message.trim().split("\n")[0]}`);
  console.error(
    "  Historique superficiel ? Ce contrôle exige `fetch-depth: 0`.",
  );
  process.exit(1);
}

const chemins = git(["diff", "--name-only", base, reference])
  .split("\n")
  .filter(Boolean);

if (chemins.length === 0) {
  console.log(
    `✅ ${branche} ne porte aucun retard de contenu sur ${reference}.`,
  );
  process.exit(0);
}

const entrees = chemins.map((chemin) => {
  if (!chemin.endsWith("package.json")) {
    return { chemin, nature: natureDuChemin(chemin) };
  }
  // Le seul fichier dont le chemin ne suffit pas : monter une `dependency` et monter une
  // `devDependency` s'écrivent au même endroit et ne portent pas le même risque.
  const lire = (rev) => {
    const brut = fichierA(rev, chemin);
    if (brut === null) return null;
    try {
      return JSON.parse(brut);
    } catch {
      return null;
    }
  };
  return { chemin, nature: natureDuManifeste(lire(branche), lire(reference)) };
});

const { escalade, runtime, dev, neutres, inconnus, verdict } =
  classerDerive(entrees);

const bloc = (titre, liste) => {
  if (liste.length === 0) return;
  console.log(`\n${titre} (${liste.length}) :`);
  for (const c of liste) console.log(`  ${c}`);
};

console.log(`${branche} en retard sur ${reference} — ${verdict}`);
bloc("EXÉCUTION — non déployé", runtime);
bloc("fabrication", dev);
bloc("neutres — leur `package.json` tranche, pas eux", neutres);
bloc("non classés — à ranger dans drift-classification.mjs", inconnus);
console.log();

if (escalade) {
  console.error(
    `✖ ${branche} porte ${runtime.length} fichier(s) d'exécution qui ne sont pas déployés.`,
  );
  process.exit(1);
}

console.log(
  `• ${branche} n'a de retard que sur la fabrication : rien à déployer d'urgent.`,
);
