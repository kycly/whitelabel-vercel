/**
 * Classer un retard de branche de déploiement par NATURE, pas seulement par taille.
 *
 * LE DÉFAUT QU'IL FERME
 *
 * `branch-drift.yml` fait son travail depuis le 2026-07-27 : les retards sont connus. Ce
 * qui manquait, c'est la hiérarchie. Le 2026-09-22, la branche `production` de
 * whitelabel-vercel a porté **2 avis critiques et 3 hauts pendant deux jours**, affichés au
 * même niveau qu'un retard de `vitest` — un paquet de test qui ne tourne jamais en
 * production.
 *
 * Un tableau qui met tout au même niveau se lit comme du bruit, et finit par ne plus être
 * lu du tout.
 *
 * LA RÈGLE
 *
 * `runtime` — ce qui change ce qui TOURNE : code applicatif, `dependencies`,
 * `peerDependencies`, `pnpm.overrides`, migrations, configuration de build. Un retard de
 * cette nature est un correctif qui n'est pas déployé : on escalade.
 *
 * `dev` — ce qui ne change que la fabrication : `devDependencies`, workflows, tests,
 * documentation, hooks. Signalé, jamais bloquant.
 *
 * CE QUE LA RÈGLE NE REGARDE PAS
 *
 * Ce que le workflow de déploiement FAIT. `deploy-dashboard-app.yml` et
 * `deploy-kyclink-app.yml` n'ont **aucun filtre `paths:`** : un retard qui ne contient que
 * du dev y déclenche quand même une reconstruction et un déploiement réels. Le classement
 * porte sur le RISQUE DU CONTENU, pas sur le déclenchement — les deux questions sont
 * distinctes et mélanger les deux rendrait le verdict incompréhensible.
 *
 * POURQUOI PAS DE CROISEMENT AVEC LES ALERTES DEPENDABOT
 *
 * Le cas de whitelabel est déjà attrapé : ses avis avaient été fermés sur `main` **en
 * montant des dépendances**, donc par un changement de `dependencies` — `runtime`, donc
 * escalade. Ajouter un appel à l'API des alertes apporterait une dépendance réseau et une
 * permission de plus pour un signal que le contenu porte déjà.
 */

/** Chemins qui changent ce qui tourne. Le premier motif qui correspond décide. */
const RUNTIME = [
  /^apps\//,
  /^lib\//,
  /^bin\//,
  /^src\//,
  /^app\//,
  /^ui\//,
  /^public\//,
  /^packages\/[^/]+\/src\//,
  /^migrations\//,
  /^sql\//,
  /^cdk\.(json|context\.json)$/,
  /(^|\/)Dockerfile$/,
  /(^|\/)(next|vite|tailwind)\.config\.[cm]?[jt]s$/,
  /(^|\/)vercel\.json$/,
];

/**
 * Chemins qui ne changent que la fabrication. Évalués AVANT `RUNTIME` : un test vit sous
 * `src/`, et sans cette priorité tout fichier de test serait classé runtime.
 */
/**
 * Fichiers dont la nature est TOUJOURS décidée par un autre : un lockfile ne cause rien, il
 * enregistre. Le classer `runtime` ferait escalader chaque montée de `devDependency` ; le
 * classer `dev` masquerait une montée de dépendance d'exécution. Il est donc neutre, et le
 * `package.json` qui l'accompagne tranche.
 */
const NEUTRE = [/(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/];

const DEV = [
  /^\.github\//,
  /^\.githooks\//,
  /^docs\//,
  /(^|\/)__tests__\//,
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /\.md$/,
  /^scripts\//,
  /(^|\/)(vitest|eslint|prettier|tsconfig)[.\w-]*\.(json|[cm]?[jt]s)$/,
  /(^|\/)\.(eslintrc|prettierrc|editorconfig|gitignore|npmrc|nvmrc)/,
  // Déclarations engendrées par l'outil de build, jamais écrites à la main.
  /(^|\/)(next-env|vite-env)\.d\.ts$/,
];

/**
 * Nature d'un chemin : `"runtime"`, `"dev"`, `"neutre"`, ou `null` quand aucun motif ne
 * décide.
 *
 * `null` n'est pas « sans importance » : c'est « le classeur n'a rien à dire ». L'appelant
 * en fait un signalement explicite plutôt qu'un silence — un fichier inconnu rangé
 * d'office en `dev` serait exactement le genre de repli qui fait passer un défaut.
 *
 * `"neutre"` est différent : c'est une décision, pas une absence de décision. Elle dit que
 * ce fichier ne peut pas trancher seul.
 */
export function natureDuChemin(chemin) {
  if (chemin.endsWith("package.json")) return null;
  if (NEUTRE.some((r) => r.test(chemin))) return "neutre";
  if (DEV.some((r) => r.test(chemin))) return "dev";
  if (RUNTIME.some((r) => r.test(chemin))) return "runtime";
  return null;
}

const champsRuntime = [
  "dependencies",
  "peerDependencies",
  "optionalDependencies",
];

/**
 * Nature d'un changement de `package.json`, en comparant les DEUX contenus.
 *
 * C'est le seul fichier dont le chemin ne suffit pas : monter une `dependency` et monter
 * une `devDependency` s'écrivent au même endroit et ne portent pas le même risque. C'est
 * précisément l'écart que le cas whitelabel demandait de voir.
 */
export function natureDuManifeste(avant, apres) {
  const memeChamp = (champ) =>
    JSON.stringify(avant?.[champ] ?? {}) ===
    JSON.stringify(apres?.[champ] ?? {});

  if (!champsRuntime.every(memeChamp)) return "runtime";
  // `pnpm.overrides` impose une version à tout l'arbre, y compris à l'exécution.
  if (
    JSON.stringify(avant?.pnpm?.overrides ?? {}) !==
    JSON.stringify(apres?.pnpm?.overrides ?? {})
  ) {
    return "runtime";
  }
  // Le champ `version` ne fait PAS de ce changement un risque d'exécution. Un bump seul est
  // une métadonnée : ce qui compte est le CONTENU du paquet, et ce contenu vit sous
  // `packages/*/src/`, que les motifs de chemin classent déjà en `runtime`. Mesuré le
  // 2026-09-25 : inclure `version` faisait escalader `@kycly/db` et `@kycly/react` sur un
  // retard qui ne portait que leur numéro, et noyait le seul vrai signal — la montée de SDK
  // dans les `dependencies` de `@kycly/core`.
  return "dev";
}

/**
 * Verdict d'un retard.
 *
 * `entrees` : `[{ chemin, nature }]` — `nature` déjà résolue par l'appelant, qui seul peut
 * lire les deux versions d'un `package.json`.
 */
export function classerDerive(entrees) {
  const runtime = entrees.filter((e) => e.nature === "runtime");
  const dev = entrees.filter((e) => e.nature === "dev");
  const neutres = entrees.filter((e) => e.nature === "neutre");
  const inconnus = entrees.filter((e) => e.nature === null);

  return {
    escalade: runtime.length > 0,
    runtime: runtime.map((e) => e.chemin),
    dev: dev.map((e) => e.chemin),
    neutres: neutres.map((e) => e.chemin),
    // Un chemin que le classeur ne sait pas ranger est NOMMÉ, pas rangé par défaut.
    inconnus: inconnus.map((e) => e.chemin),
    verdict:
      runtime.length > 0
        ? `ESCALADE — ${runtime.length} fichier(s) d'exécution non déployé(s)`
        : inconnus.length > 0
          ? `SIGNALE — ${dev.length} fichier(s) de fabrication, ${inconnus.length} non classé(s)`
          : `SIGNALE — ${dev.length} fichier(s) de fabrication seulement`,
  };
}
