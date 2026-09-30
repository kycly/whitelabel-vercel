#!/usr/bin/env node
/**
 * check-workflow-env-values — garde-fou sur les VALEURS de domaine écrites dans les
 * workflows GitHub Actions.
 *
 * LE DÉFAUT QU'IL FERME
 *
 * `kyclink-access-e2e.yml` a porté `API_ENDPOINT: https://api.kycly.io` du 2026-08-03 au
 * 2026-09-24. Ce workflow ne se déclenche que sur la branche `staging` et prend son rôle
 * OIDC dans le compte de staging — mais une URL ne suit pas les identifiants. Trois
 * passages ont listé des clients, repris une session et fait tourner une clé partenaire
 * EN PRODUCTION, en restant VERTS : ils obtenaient bien des 200, simplement d'une autre
 * API que celle qu'ils prétendaient exercer.
 *
 * POURQUOI AUCUN GARDE EXISTANT NE L'A VU
 *
 * `check-doc-truth`, `-structure` et `-freshness` valident de la documentation et des
 * chemins ; `check-doc-drift` exige des documents. Aucun ne lit une VALEUR dans
 * `.github/workflows/`. Et les deux balayages de la famille « repli figé » cherchaient
 * `|| "https://` et `?? "https://` DANS LE CODE SOURCE : ici il n'y a aucun repli à
 * trouver, juste une constante qui a cessé d'être vraie le jour où la production est née.
 *
 * LA RÈGLE
 *
 * Un littéral de domaine `*.kycly.io` est propre à UN environnement. Le workflow qui le
 * porte doit être propre au MÊME environnement, et à lui seul :
 *
 *   - le stage du workflow se lit dans ses déclencheurs (`on.push.branches`, et les
 *     `options` de `workflow_dispatch`) ;
 *   - le stage du domaine se lit par convention de nommage (`*.staging.kycly.io` ou
 *     `staging-*.kycly.io` = staging, tout le reste = production). VERSION PORTÉE : dans
 *     infrastructure-node, les domaines d'API sont en plus comparés EXACTEMENT à
 *     `apiDomains` (source de vérité de `packages/core`). Ce dépôt ne porte pas cette
 *     source et n'importe pas `@kycly/core` pour un garde de CI : la convention couvre
 *     les domaines d'API existants (`api.staging.kycly.io` / `api.kycly.io`) ;
 *   - un workflow qui sert PLUSIEURS stages — ou qui tourne aussi sur `main` — ne peut
 *     porter aucun domaine propre à un stage. Il doit passer par une variable
 *     d'environnement GitHub, comme `vars.APP_URL` dans dashboard-node et kyclink-node.
 *
 * CE QU'IL NE FAIT PAS
 *
 * Il ne juge pas les lignes commentées : le commentaire au-dessus de `API_ENDPOINT` cite
 * l'ancienne URL de production, et l'inclure ferait échouer le garde sur sa propre
 * documentation.
 *
 * Exemptions : `scripts/workflow-url-allowlist.json`, chaque entrée datée et motivée —
 * c'est la forme qu'ont déjà les scellements d'audit de ce dépôt.
 *
 * Sortie non nulle dès une erreur. Lancé par `pnpm ci:check-workflow-urls`.
 *
 * Porté depuis infrastructure-node (lot A du plan parc-et-gardes, phase 3, 2026-09-30).
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOW_DIR = path.join(ROOT, ".github", "workflows");
const ALLOWLIST = path.join(ROOT, "scripts", "workflow-url-allowlist.json");

const STAGES = ["staging", "production"];
const DOMAIN_RE = /https?:\/\/([A-Za-z0-9.-]*\bkycly\.io)\b/g;

// Domaines de staging qui ne suivent PAS la convention de nommage. Sans cette liste,
// `dev.kycly.io` (le dashboard de STAGING, `vars.APP_URL` de l'environnement staging de
// dashboard-node) était classé en production : un workflow de production qui l'aurait
// porté passait au vert. Trouvé au portage du lot A, 2026-09-30.
const STAGING_HORS_CONVENTION = new Set(["dev.kycly.io", "staging.kycly.io"]);

/** Stage auquel appartient un domaine, ou null s'il n'est propre à aucun. */
function stageDuDomaine(hote) {
  // Convention de nommage du parc, appliquée aussi aux domaines d'API (la table
  // exacte n'existe que dans infrastructure-node).
  if (
    STAGING_HORS_CONVENTION.has(hote) ||
    hote.endsWith(".staging.kycly.io") ||
    /^staging-/.test(hote)
  )
    return "staging";
  if (hote === "kycly.io") return null; // la racine seule ne désigne aucun environnement
  return "production";
}

/**
 * Stages sur lesquels un workflow peut tourner.
 *
 * Rend `{ stages, ambigu }`. `ambigu` vaut vrai dès qu'un déclencheur ouvre le workflow à
 * autre chose qu'un stage — `main`, un `schedule`, un `workflow_dispatch` sans choix
 * borné. Dans ce cas AUCUN domaine propre à un stage n'est acceptable.
 */
function stagesDuWorkflow(texte) {
  const lignes = texte.split("\n");
  const debut = lignes.findIndex((l) => /^on:/.test(l));
  if (debut === -1) return { stages: new Set(), ambigu: true };

  const bloc = [];
  for (let i = debut + 1; i < lignes.length; i += 1) {
    if (/^\S/.test(lignes[i])) break; // retour au premier niveau : fin du bloc `on:`
    bloc.push(lignes[i]);
  }

  const utiles = bloc.filter((l) => !l.trimStart().startsWith("#"));
  const tokens = [];
  let dansListe = false;
  let indentListe = 0;

  for (const ligne of utiles) {
    const cle = /^(\s*)(branches|options)\s*:\s*(.*)$/.exec(ligne);
    if (cle) {
      const [, indent, , reste] = cle;
      if (reste.trim()) {
        // Forme en flux : `branches: [main, staging]`
        tokens.push(
          ...reste
            .replace(/[[\]]/g, "")
            .split(",")
            .map((t) => t.trim()),
        );
        dansListe = false;
      } else {
        dansListe = true;
        indentListe = indent.length;
      }
      continue;
    }
    if (!dansListe) continue;
    const item = /^(\s*)-\s*(.+?)\s*$/.exec(ligne);
    if (item && item[1].length > indentListe) {
      tokens.push(item[2].replace(/['"]/g, ""));
    } else if (ligne.trim() && !/^\s*$/.test(ligne)) {
      const indentCourant = ligne.length - ligne.trimStart().length;
      if (indentCourant <= indentListe) dansListe = false;
    }
  }

  const propres = tokens.filter(Boolean);
  const stages = new Set(propres.filter((t) => STAGES.includes(t)));
  const ambigu =
    propres.length === 0 ||
    propres.some((t) => !STAGES.includes(t)) ||
    /^\s*schedule:/m.test(bloc.join("\n"));

  return { stages, ambigu };
}

/** Retire les commentaires : ligne entière, puis commentaire de fin de ligne. */
function partieActive(ligne) {
  if (ligne.trimStart().startsWith("#")) return "";
  return ligne.replace(/\s#.*$/, "");
}

const exemptions = existsSync(ALLOWLIST)
  ? JSON.parse(readFileSync(ALLOWLIST, "utf8"))
  : [];
const estExempte = (fichier, hote) =>
  exemptions.some((e) => e.workflow === fichier && e.domaine === hote);

const fichiers = existsSync(WORKFLOW_DIR)
  ? readdirSync(WORKFLOW_DIR)
      .filter((f) => /\.ya?ml$/.test(f))
      .sort()
  : [];

// Une recherche qui ne trouve rien passerait tous les contrôles en silence. On affirme
// donc que le périmètre n'est pas vide avant de conclure quoi que ce soit.
if (fichiers.length === 0) {
  console.error(
    `✖ Aucun workflow trouvé sous ${path.relative(ROOT, WORKFLOW_DIR)}.`,
  );
  console.error(
    "  Le garde n'a rien pu vérifier : c'est un échec, pas un succès.",
  );
  process.exit(1);
}

const erreurs = [];
let literaux = 0;

for (const fichier of fichiers) {
  const texte = readFileSync(path.join(WORKFLOW_DIR, fichier), "utf8");
  const { stages, ambigu } = stagesDuWorkflow(texte);

  texte.split("\n").forEach((ligne, index) => {
    const active = partieActive(ligne);
    if (!active) return;
    for (const match of active.matchAll(DOMAIN_RE)) {
      const hote = match[1];
      const stage = stageDuDomaine(hote);
      if (!stage) continue;
      literaux += 1;
      if (estExempte(fichier, hote)) continue;

      const attendu = `un domaine de ${[...stages].join("/") || "l'environnement visé"}`;

      if (ambigu || stages.size !== 1) {
        erreurs.push({
          fichier,
          ligne: index + 1,
          hote,
          motif:
            stages.size > 1
              ? `le workflow sert ${[...stages].join(" et ")} : aucun domaine propre à un stage ne peut y être écrit en dur`
              : "le workflow n'est pas propre à un stage (branche hors stage, schedule ou dispatch non borné) : passer par une variable d'environnement GitHub",
        });
      } else if (!stages.has(stage)) {
        erreurs.push({
          fichier,
          ligne: index + 1,
          hote,
          motif: `domaine de ${stage}, alors que le workflow ne tourne que sur ${[...stages][0]} — attendu ${attendu}`,
        });
      }
    }
  });
}

if (erreurs.length > 0) {
  console.error(
    "✖ Domaines propres à un environnement écrits dans le mauvais workflow\n",
  );
  for (const e of erreurs) {
    console.error(`  .github/workflows/${e.fichier}:${e.ligne}`);
    console.error(`    trouvé  : ${e.hote}`);
    console.error(`    motif   : ${e.motif}\n`);
  }
  console.error(
    `${erreurs.length} erreur(s) sur ${literaux} littéral(aux) examiné(s), ${fichiers.length} workflow(s).`,
  );
  process.exit(1);
}

console.log(
  `✅ ${literaux} littéral(aux) de domaine vérifié(s) sur ${fichiers.length} workflow(s) : chacun vise le stage qui le déclenche.`,
);
