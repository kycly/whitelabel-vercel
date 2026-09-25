/**
 * Déclaration de type pour le garde anti fail-open.
 *
 * Le script est en JavaScript et le restera : il tourne sous `node` sans étape de
 * compilation, y compris depuis un hook git. Cette déclaration existe pour que son test
 * puisse l'importer sans faire tomber `tsc --noEmit`, et sans `@ts-expect-error` — une
 * directive qui devient elle-même une erreur (TS2578) dans les dépôts dont le tsconfig
 * résout déjà le `.mjs`. Elle ne se comportait donc pas pareil d'un dépôt à l'autre.
 */

/** Un fail-open constaté, avec son motif et ce qu'il faut écrire à la place. */
export interface ConstatFailOpen {
  /** Numéro de ligne, base 1. */
  ligne: number;
  /** La ligne fautive, sans son indentation. */
  extrait: string;
  /** Ce qui est reproché. */
  motif: string;
  /** Ce qu'il faut écrire à la place. */
  remede: string;
}

/** Les constats d'un texte de workflow. Liste vide = rien à signaler. */
export function analyser(texte: string): ConstatFailOpen[];

/** Les constats de tous les workflows du dépôt, chacun portant son `fichier`. */
export function analyserDepot(
  racine: string,
): Array<ConstatFailOpen & { fichier: string }>;
