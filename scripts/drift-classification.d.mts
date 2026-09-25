/**
 * Déclaration de type pour le classement des retards de branche.
 *
 * Le script reste en JavaScript : il tourne sous `node` sans étape de compilation. Cette
 * déclaration existe pour que son test l'importe sans `@ts-expect-error` — une directive
 * qui devient elle-même une erreur (TS2578) là où le tsconfig résout déjà le `.mjs`.
 */

/**
 * `"runtime"` change ce qui tourne, `"dev"` seulement la fabrication, `"neutre"` ne peut pas
 * trancher seul (un lockfile), `null` = le classeur n'a rien à dire — ce qui se signale au
 * lieu de se ranger par défaut.
 */
export type Nature = "runtime" | "dev" | "neutre" | null;

export interface Entree {
  chemin: string;
  nature: Nature;
}

export interface VerdictDerive {
  /** Vrai dès un seul fichier d'exécution non déployé. */
  escalade: boolean;
  runtime: string[];
  dev: string[];
  neutres: string[];
  /** Chemins qu'aucun motif ne range : nommés, jamais classés d'office. */
  inconnus: string[];
  verdict: string;
}

/** Nature déduite du seul chemin. Rend `null` pour un `package.json`. */
export function natureDuChemin(chemin: string): Nature;

/**
 * Nature d'un changement de `package.json`, en comparant les deux contenus — le seul
 * fichier dont le chemin ne suffit pas.
 */
export function natureDuManifeste(
  avant: Record<string, unknown> | null,
  apres: Record<string, unknown> | null,
): "runtime" | "dev";

export function classerDerive(entrees: Entree[]): VerdictDerive;
