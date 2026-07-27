#!/usr/bin/env node

/**
 * Audit de securite des dependances, sur l'arbre pnpm REELLEMENT installe.
 *
 * POURQUOI CE DEPOT EN A UN (mesure le 2026-07-27)
 *
 * Ce depot n'avait AUCUNE barriere d'audit : ni etape dans la CI, ni cron, ni
 * `dependabot.yml`. Il etait le dernier des cinq dans cet etat. La premiere execution de
 * ce script y a trouve **13 avis `high` et 8 `moderate` reels** sur 340 paquets — dont
 * quatre `high` sur `next` lui-meme.
 *
 * Deux raisons de ne pas se contenter de `npm audit` ou `pnpm audit`, toutes deux
 * constatees sur les quatre autres depots et non supposees :
 *
 *   1. npm ignore `pnpm.overrides`. Il reconstruit donc un arbre que pnpm ne produit
 *      jamais. D'ou des faux positifs, mais surtout des ANGLES MORTS : 16 avis `high`
 *      reels etaient invisibles pour lui sur infrastructure-node et dashboard-node.
 *
 *   2. Le registre renvoie des octets gzip **sans en-tete `content-encoding`** au-dela
 *      d'une certaine taille de reponse. `pnpm audit`, `npm audit` et le `fetch` de Node
 *      echouent identiquement au-dessus du seuil. Ce n'est pas un bug de client : c'est le
 *      protocole qui est viole. Un audit dont la reponse grossit peut donc casser sans
 *      qu'aucune dependance n'ait change.
 *
 * CE QUE FAIT CELUI-CI
 *
 * Il lit les versions que pnpm a reellement resolues dans `pnpm-lock.yaml`, les soumet a
 * l'endpoint bulk d'avis du registre, et decompresse lui-meme le gzip non declare. La
 * reponse de l'endpoint ne contient que les avis affectant les versions soumises.
 *
 * INVARIANT : ce script echoue en BLOQUANT, jamais en passant. Toute anomalie — reseau,
 * HTTP non-2xx, corps vide, JSON illisible, lockfile dont on n'extrait aucun paquet —
 * vaut echec. L'absence de signal d'erreur n'est jamais interpretee comme un succes.
 *
 * SEUIL. Seuls les avis `high`/`critical` bloquent. Les autres sont AFFICHES, jamais
 * jetes en silence : les jeter avait un cout constate le 2026-07-26 — 7 avis moderes et
 * bas n'existaient que dans l'interface Dependabot, et leur correction n'a ete decidee
 * qu'apres que ses jobs de correction automatique aient echoue en rouge pendant des
 * heures. Les afficher n'influence jamais le code de sortie.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import zlib from "node:zlib";

const BULK_ENDPOINT =
  "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk";
const BLOCKING_SEVERITIES = new Set(["high", "critical"]);
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Avis scelles : acceptes en connaissance de cause, malgre une version resolue dans la
 * plage affectee.
 *
 * AVANT D'AJOUTER UNE ENTREE ICI, deux verifications obligatoires :
 *   1. la plage affectee de l'avis (`vulnerable_versions`, affichee par ce script) ;
 *   2. la version que pnpm resout reellement (`pnpm-lock.yaml`).
 *
 * Ne jamais sceller sur la presomption « cette version est patchee ». Le scellement
 * `brace-expansion` de l'ancien script affirmait exactement cela — « l'advisory ne touche
 * que <=4.0.0 » — alors que GHSA-3jxr-9vmj-r5cp frappe `>=3.0.0 <5.0.7` et que pnpm
 * resolvait 5.0.5. Une vraie vulnerabilite est restee masquee derriere ce commentaire.
 *
 * Un scellement doit porter : la plage affectee, la version resolue, la raison pour
 * laquelle l'exposition est nulle, et ce qui le levera.
 *
 * Forme attendue : url => { reason, precondition? }. `precondition` rend la premisse
 * VERIFIABLE : elle est reevaluee a chaque execution et renvoie { ok, why }. Un scellement
 * dont la premisse repose sur une configuration doit cesser de valoir des que cette
 * configuration change — sinon il devient exactement ce que l'on cherche a interdire : une
 * affirmation qui a cesse d'etre vraie sans que personne ne s'en apercoive. Voir les deux
 * scellements de dashboard-node pour un exemple complet.
 */
const SEALED_ADVISORIES = new Map([
  [
    "https://github.com/advisories/GHSA-qjx8-664m-686j",
    {
      reason:
        "js-cookie <=3.0.5, resolu en 2.2.1, impose par amazon-cognito-identity-js. " +
        "La montee en v3 est EXCLUE et le fait est mesure, pas suppose : le paquet " +
        "importe `get`/`set`/`remove` en exports nommes, que js-cookie v3 n'expose plus " +
        "(export par defaut uniquement). L'override `js-cookie: \">=3.0.7\", repris de " +
        "dashboard-node ou le parent est different, a fait echouer `pnpm build` le " +
        "2026-07-27 : `The export get was not found in module js-cookie@3.0.8`. " +
        "Exposition nulle et demontree : dans ce paquet, js-cookie n'est importe que par " +
        "CookieStorage.js, et cette application n'utilise jamais CookieStorage — " +
        "CognitoUserPool y est construit sans option `Storage`, donc la bibliotheque " +
        "retombe sur localStorage. Le code de js-cookie n'est jamais execute. " +
        "LEVEE : des qu'amazon-cognito-identity-js passe a js-cookie v3, ou des que " +
        "cette application configure CookieStorage — auquel cas la precondition " +
        "ci-dessous echoue d'elle-meme.",
      precondition: jsCookieNeverInvoked,
    },
  ],
  [
    "https://github.com/advisories/GHSA-mh99-v99m-4gvg",
    {
      reason:
        "brace-expansion <=5.0.7. La branche v5 est corrigee et forcee en >=5.0.8 par " +
        "l'override `minimatch@10>brace-expansion`. Reste la branche v1, imposee par " +
        "minimatch@3 : elle s'arrete a 1.1.16 et cet avis n'y a AUCUN correctif. La " +
        "forcer en v5 est exclu — minimatch@3 attend l'API v1 et casse " +
        "(`TypeError: expand is not a function`, constate le 2026-07-26 sur kyclink-node). " +
        "Exposition : minimatch@3 ne vient que de la chaine ESLint, un outil de " +
        "developpement qui n'expanse que nos propres motifs de configuration. Il n'entre " +
        "dans aucun artefact deploye — Vercel sert la sortie de `next build`, et les " +
        "devDependencies n'y figurent pas. " +
        "LEVEE : des qu'un correctif v1 parait, ou qu'ESLint abandonne minimatch@3.",
      precondition: braceExpansionRiskConfined,
    },
  ],
]);

/**
 * Verifie les deux premisses du scellement `js-cookie` :
 *
 *   1. aucun fichier source ne mentionne CookieStorage ni js-cookie — les mentionner
 *      signifierait que le code vulnerable devient atteignable ;
 *   2. aucune construction Cognito ne passe d'option `Storage`, seule facon de detourner
 *      la bibliotheque de son localStorage par defaut vers CookieStorage.
 */
function jsCookieNeverInvoked() {
  const roots = ["src", "app"].map((dir) => path.join(repoRoot, dir));
  const offenders = [];
  const storageOption = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) continue;

      const source = fs.readFileSync(full, "utf8");
      const relative = path.relative(repoRoot, full);

      if (/CookieStorage|js-cookie/.test(source)) offenders.push(relative);
      if (/\bStorage\s*:/.test(source) && /Cognito(UserPool|User)\b/.test(source)) {
        storageOption.push(relative);
      }
    }
  }

  roots.forEach(walk);

  if (offenders.length > 0) {
    return {
      ok: false,
      why: `CookieStorage ou js-cookie est reference par : ${offenders.join(", ")}`,
    };
  }

  if (storageOption.length > 0) {
    return {
      ok: false,
      why: `une option \`Storage\` est passee a Cognito dans : ${storageOption.join(", ")}`,
    };
  }

  return { ok: true };
}

/**
 * Verifie les deux premisses du scellement `brace-expansion` :
 *
 *   1. la branche v5 reste au-dessus du correctif (>=5.0.8) — sans quoi le scellement,
 *      pose par URL d'avis et non par version, masquerait une regression reelle ;
 *   2. minimatch@3 — seul a imposer la branche v1 non corrigeable — ne vient que de la
 *      chaine ESLint. Un consommateur applicatif ferait entrer le risque dans du code
 *      deploye, et le scellement cesserait de valoir.
 */
function braceExpansionRiskConfined() {
  const lockfile = fs.readFileSync(path.join(repoRoot, "pnpm-lock.yaml"), "utf8");
  const lines = lockfile.split("\n");

  const versions = new Set();
  for (const line of lines) {
    const match = /^ {2}brace-expansion@([0-9][^:(]*)[:(]/.exec(line);
    if (match) versions.add(match[1].trim());
  }

  if (versions.size === 0) {
    return { ok: false, why: "aucune version de brace-expansion trouvee dans le lockfile" };
  }

  for (const version of versions) {
    if (version.startsWith("1.")) continue;

    const [major, minor, patch] = version.split(".").map(Number);
    const atLeast508 = major > 5 || (major === 5 && (minor > 0 || patch >= 8));

    if (!atLeast508) {
      return {
        ok: false,
        why: `brace-expansion ${version} est en-dessous du correctif 5.0.8 de la branche v5`,
      };
    }
  }

  // Consommateurs de minimatch@3 : le nom du paquet precede son bloc de dependances.
  const eslintToolchain = /^'?(eslint|@eslint\/|eslint-plugin-|eslint-config-|@eslint-community\/)/;
  const outsiders = [];
  let currentPackage = null;

  for (const line of lines) {
    const packageMatch = /^ {2}('?[^\s:]+):\s*$/.exec(line);
    if (packageMatch) currentPackage = packageMatch[1];

    if (/^\s+minimatch:\s*3\./.test(line) && currentPackage) {
      if (!eslintToolchain.test(currentPackage)) outsiders.push(currentPackage);
    }
  }

  if (outsiders.length > 0) {
    return {
      ok: false,
      why:
        `minimatch@3 n'est plus confine a la chaine ESLint — impose aussi par : ` +
        `${[...new Set(outsiders)].join(", ")}`,
    };
  }

  return { ok: true };
}

function fail(message) {
  process.stderr.write(`\n[audit-pnpm-tree] ECHEC : ${message}\n`);
  process.exit(1);
}

/**
 * Extrait les couples nom@version des sections `packages:` et `snapshots:` du lockfile.
 *
 * Le format est `  nom@version:` ou `  nom@version(peer)...:`. pnpm ENTOURE DE QUOTES les
 * cles dont le nom est scope : `  '@babel/core@7.29.0':`. Le motif doit donc accepter ce
 * guillemet, en tete comme avant le deux-points — a defaut, TOUS les paquets scopes sont
 * ignores en silence. C'etait le cas jusqu'au 2026-07-27 : sur whitelabel-vercel, 350
 * entrees scopees sur 1103 n'etaient jamais soumises au registre, et l'avis
 * GHSA-4x5r-pxfx-6jf8 sur @babel/core@7.29.0 n'existait que dans l'interface Dependabot.
 *
 * Les paquets @kycly/* sont exclus : ils sont publies par nos soins et le registre public
 * n'en sait rien — les soumettre ne produirait que du bruit.
 */
function readResolvedVersions(lockfilePath) {
  if (!fs.existsSync(lockfilePath)) {
    fail(`lockfile absent : ${lockfilePath}`);
  }

  const lockfile = fs.readFileSync(lockfilePath, "utf8");
  const versionsByName = new Map();

  for (const line of lockfile.split("\n")) {
    const match = /^ {2}['"]?(@?[^@\s'"][^@]*)@([0-9][^:('"]*)['"]?(\(|:)/.exec(line);
    if (!match) continue;

    const [, name, rawVersion] = match;
    if (name.startsWith("@kycly/")) continue;

    if (!versionsByName.has(name)) versionsByName.set(name, new Set());
    versionsByName.get(name).add(rawVersion.trim());
  }

  // Detection positive : un lockfile dont on n'extrait rien signale un changement de
  // format, pas un depot sans dependance. Se taire ici reviendrait a rendre l'audit vert
  // en n'auditant rien — precisement le mode de defaillance que ce script existe pour
  // interdire.
  if (versionsByName.size === 0) {
    fail(
      `aucun paquet extrait de ${lockfilePath}. Le format du lockfile a probablement ` +
        `change (lockfileVersion) : corriger l'extraction avant de reactiver l'audit.`,
    );
  }

  return versionsByName;
}

async function fetchAdvisories(payload) {
  let response;

  try {
    response = await fetch(BULK_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    fail(`requete vers le registre impossible : ${error.message}`);
  }

  if (!response.ok) {
    fail(`le registre a repondu ${response.status} ${response.statusText}`);
  }

  let bytes = Buffer.from(await response.arrayBuffer());

  if (bytes.length === 0) {
    fail("le registre a repondu un corps vide");
  }

  // Le gzip non declare, cause racine de la panne des audits natifs : on le detecte par
  // les octets magiques plutot que par l'en-tete, justement parce que l'en-tete manque.
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    try {
      bytes = zlib.gunzipSync(bytes);
    } catch (error) {
      fail(`reponse gzip illisible : ${error.message}`);
    }
  }

  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    fail(`reponse JSON illisible : ${error.message}`);
  }
}

function collectFindings(advisoriesByName, versionsByName) {
  const blocking = [];
  const sealed = [];
  const informational = [];

  for (const [name, advisories] of Object.entries(advisoriesByName)) {
    if (!Array.isArray(advisories)) {
      fail(`reponse inattendue pour ${name} : un tableau d'avis etait attendu`);
    }

    for (const advisory of advisories) {
      const finding = {
        name,
        severity: advisory.severity,
        vulnerableVersions: advisory.vulnerable_versions,
        resolved: [...(versionsByName.get(name) ?? [])].join(", "),
        url: advisory.url,
        title: advisory.title,
      };

      // Sous le seuil de blocage : on les REMONTE au lieu de les jeter. Les jeter avait
      // un cout constate — les 7 avis moderes et bas du 2026-07-26 n'etaient visibles
      // que dans l'interface Dependabot, et leur correction n'a ete decidee qu'apres que
      // les jobs de correction automatique aient echoue en rouge pendant des heures.
      // Les afficher ici les met sous les yeux de qui lance l'audit, sans jamais
      // influencer le code de sortie.
      if (!BLOCKING_SEVERITIES.has(advisory.severity)) {
        informational.push(finding);
        continue;
      }

      const seal = advisory.url
        ? SEALED_ADVISORIES.get(advisory.url)
        : undefined;

      if (!seal) {
        blocking.push(finding);
        continue;
      }

      // Un scellement ne vaut que tant que sa premisse tient. On l'evalue a chaque
      // execution plutot que de faire confiance a ce qui etait vrai le jour ou il a ete
      // ecrit : c'est le seul moyen qu'il redevienne bloquant tout seul.
      const premise = seal.precondition ? seal.precondition() : { ok: true };

      if (!premise.ok) {
        blocking.push({
          ...finding,
          note:
            `scellement ANNULE — sa premisse est tombee : ${premise.why}. ` +
            `Motif d'origine : ${seal.reason}`,
        });
        continue;
      }

      sealed.push({ ...finding, reason: seal.reason });
    }
  }

  return { blocking, sealed, informational };
}

function describe(finding) {
  return (
    `  ${finding.severity.padEnd(8)} ${finding.name}\n` +
    `           plage affectee : ${finding.vulnerableVersions}\n` +
    `           resolu par pnpm : ${finding.resolved || "(inconnu)"}\n` +
    `           ${finding.url}` +
    (finding.note ? `\n           ${finding.note}` : "")
  );
}

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const lockfilePath = path.join(repoRoot, "pnpm-lock.yaml");

const versionsByName = readResolvedVersions(lockfilePath);
const payload = Object.fromEntries(
  [...versionsByName].map(([name, versions]) => [name, [...versions]]),
);

process.stdout.write(
  `[audit-pnpm-tree] ${versionsByName.size} paquets lus dans pnpm-lock.yaml, ` +
    `interrogation du registre...\n`,
);

const advisoriesByName = await fetchAdvisories(payload);
const { blocking, sealed, informational } = collectFindings(
  advisoriesByName,
  versionsByName,
);

for (const finding of sealed) {
  process.stdout.write(
    `[audit-pnpm-tree] avis scelle, ignore :\n${describe(finding)}\n`,
  );
  process.stdout.write(`           motif : ${finding.reason}\n`);
}

// Affiche AVANT le verdict bloquant, pour rester lisible meme quand l'audit echoue.
if (informational.length > 0) {
  process.stdout.write(
    `\n[audit-pnpm-tree] ${informational.length} avis sous le seuil de blocage ` +
      `(pour information, n'affecte pas le code de sortie) :\n\n`,
  );
  for (const finding of informational) {
    process.stdout.write(`${describe(finding)}\n\n`);
  }
  process.stdout.write(
    `Pour en corriger un : poser un plancher dans pnpm.overrides, BORNE sous la majeure\n` +
      `suivante — par exemple ">=6.15.2 <7". Sans cette borne, pnpm franchit la majeure et\n` +
      `casse les consommateurs qui attendent l'API precedente (constate le 2026-07-26 avec\n` +
      `js-yaml, monte en 5.x, qui a fait sauter @eslint/eslintrc).\n` +
      `Un override global ne vaut que si le paquet n'a QU'UNE version dans l'arbre : sinon\n` +
      `le scoper (\`parent>paquet\`), comme brace-expansion dont la branche v1 est\n` +
      `incompatible avec la v5.\n` +
      `Ne pas compter sur Dependabot pour ces cas : il n'ecrit pas de pnpm.overrides, et\n` +
      `l'option \`dependency-type: indirect\` n'existe pas pour l'ecosysteme npm.\n\n`,
  );
}

if (blocking.length > 0) {
  process.stderr.write(
    `\n[audit-pnpm-tree] ${blocking.length} avis ${[...BLOCKING_SEVERITIES].join("/")} ` +
      `non scelle(s) dans l'arbre pnpm installe :\n\n`,
  );
  for (const finding of blocking) {
    process.stderr.write(`${describe(finding)}\n\n`);
  }
  process.stderr.write(
    `Corriger par une montee de version ou un override pnpm SCOPE, puis relancer.\n` +
      `Sceller n'est legitime que si l'exposition est demontree nulle : lire la consigne ` +
      `en tete de ce fichier avant d'y toucher.\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `[audit-pnpm-tree] aucun avis high/critical non scelle dans l'arbre pnpm ` +
    `(${versionsByName.size} paquets audites, ${sealed.length} scelle(s), ` +
    `${informational.length} sous le seuil).\n`,
);
