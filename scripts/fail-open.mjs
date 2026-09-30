/**
 * Détection des gardes qui échouent EN VERT.
 *
 * LE MOTIF
 *
 * Dix occurrences recensées sur ce codebase, dont deux le 2026-09-24 et une le
 * 2026-09-25. Deux d'entre elles étaient mes propres gardes. Le motif ne s'apprend pas :
 * il se mécanise.
 *
 *   - la boucle d'attente MinIO (`curl -sf … || sleep 2`) se terminait sans bruit après
 *     20 essais, et les tests e2e partaient contre un stockage absent — l'erreur
 *     remontait ailleurs, loin de sa cause ;
 *   - `if [ -z "$APP_URL" ]; then echo "smoke test ignoré"` sort en SUCCÈS quand la
 *     variable manque ;
 *   - `ci.yml` n'exécute le balayage CloudWatch que si un secret existe au niveau du
 *     dépôt. Il n'existe que par environnement : le pas se réduit à un `::warning::`, et
 *     ce balayage n'a JAMAIS tourné depuis sa création.
 *
 * CE QUE LE GARDE CHERCHE
 *
 *   1. `|| true` / `|| :` en fin de commande ;
 *   2. une boucle d'attente (`for`/`while` autour d'un `curl`/`nc`/`pg_isready`) qui se
 *      termine sans `exit 1` ;
 *   3. `if [ -z "$X" ]` dont le corps ne sort jamais en échec ;
 *   4. un `if:` de PAS qui teste la vacuité d'un secret, d'une variable ou d'une valeur
 *      d'environnement — la forme la plus silencieuse, parce qu'elle ne laisse même pas
 *      une ligne dans le journal du pas sauté ;
 *   5. `continue-on-error: true` sans commentaire qui le justifie.
 *
 * Les exemptions vivent dans `scripts/fail-open-allowlist.json`, chacune **datée et
 * motivée** — la forme qu'ont déjà les scellements d'audit de ce dépôt. Une exemption
 * assume un fail-open ; elle ne le cache pas.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const COMMANDES_DATTENTE =
  /\b(curl|wget|nc|pg_isready|docker\s+(exec|inspect))\b/;
// `::error::` n'a PAS de `\b` devant : il apparaît presque toujours collé à un guillemet
// (`echo "::error::…"`), et entre `"` et `:` il n'y a aucune frontière de mot. La version
// initiale portait ce `\b` en tête de l'alternation et signalait donc comme fail-open des
// contrôles qui échouaient correctement — trouvé en portant le garde sur kyclink-node.
const SORTIE_EN_ECHEC = /\bexit\s+[1-9]|\bexit\s+"?\$|\bfail\b|::error::/;

function estCommentaire(ligne) {
  return ligne.trimStart().startsWith("#");
}

/** Indentation en nombre d'espaces. */
const indent = (ligne) => ligne.length - ligne.trimStart().length;

/**
 * Chaque constat porte son motif ET ce qu'il faudrait faire à la place : un garde qui
 * signale sans dire quoi écrire se fait désactiver.
 */
function constat(ligne, extrait, motif, remede) {
  return { ligne, extrait: extrait.trim(), motif, remede };
}

export function analyser(texte) {
  const lignes = texte.split("\n");
  const constats = [];

  for (let i = 0; i < lignes.length; i += 1) {
    const ligne = lignes[i];
    const n = i + 1;
    if (estCommentaire(ligne)) continue;

    // 1. `|| true` et `|| :`
    if (/\|\|\s*(true|:)\s*(#.*)?$/.test(ligne)) {
      constats.push(
        constat(
          n,
          ligne,
          "`|| true` avale l'échec de la commande",
          "retirer le repli, ou l'exempter avec sa raison si l'échec est vraiment sans conséquence",
        ),
      );
    }

    // 4. `if:` de pas qui teste une vacuité
    if (/^\s*if:\s*/.test(ligne)) {
      const expression = lignes
        .slice(i, i + 4)
        .join(" ")
        .replace(/\s+/g, " ");
      if (/(secrets|vars|env)\.[A-Za-z_][\w]*\s*[=!]=\s*''/.test(expression)) {
        constats.push(
          constat(
            n,
            ligne,
            "ce pas se SAUTE quand une valeur manque, sans rien signaler",
            "faire échouer le pas sur la valeur absente, ou déclarer l'environnement qui la porte",
          ),
        );
      }
    }

    // 5. `continue-on-error: true` non commenté
    if (/^\s*continue-on-error:\s*true\s*$/.test(ligne)) {
      const precedente = lignes[i - 1] ?? "";
      if (!estCommentaire(precedente)) {
        constats.push(
          constat(
            n,
            ligne,
            "`continue-on-error: true` sans justification",
            "ajouter juste au-dessus un commentaire disant pourquoi l'échec est acceptable",
          ),
        );
      }
    }

    // 3. `if [ -z "$X" ]` sans sortie en échec
    if (/^\s*if\s+\[\[?\s+-z\s+/.test(ligne)) {
      const base = indent(ligne);
      let corps = "";
      for (let j = i + 1; j < lignes.length; j += 1) {
        if (/^\s*fi\b/.test(lignes[j]) && indent(lignes[j]) <= base) break;
        corps += `${lignes[j]}\n`;
      }
      if (!SORTIE_EN_ECHEC.test(corps)) {
        constats.push(
          constat(
            n,
            ligne,
            "une valeur absente ne fait pas échouer le pas",
            "sortir en `exit 1` : une variable manquante est un défaut de configuration, pas un cas nominal",
          ),
        );
      }
    }

    // 2. boucle d'attente qui se termine sans échec
    if (/^\s*(for|while)\s+/.test(ligne)) {
      const base = indent(ligne);
      let corps = "";
      let ligneDone = -1;
      for (let j = i + 1; j < lignes.length; j += 1) {
        if (/^\s*done\b/.test(lignes[j]) && indent(lignes[j]) <= base) {
          ligneDone = j;
          break;
        }
        corps += `${lignes[j]}\n`;
      }
      if (ligneDone !== -1 && COMMANDES_DATTENTE.test(corps)) {
        // La sortie en échec peut être DANS la boucle ou juste après le `done` : le
        // motif correct est « échouer quand les essais sont épuisés ».
        const apres = lignes.slice(ligneDone + 1, ligneDone + 8).join("\n");
        if (!SORTIE_EN_ECHEC.test(corps) && !SORTIE_EN_ECHEC.test(apres)) {
          constats.push(
            constat(
              n,
              ligne,
              "boucle d'attente qui se termine sans échouer",
              "après le `done`, `exit 1` avec un message : les essais épuisés sont un échec, pas une réussite",
            ),
          );
        }
      }
    }
  }

  return constats;
}

export function analyserDepot(racine) {
  const dossier = path.join(racine, ".github", "workflows");
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier)
    .filter((f) => /\.ya?ml$/.test(f))
    .sort()
    .flatMap((fichier) =>
      analyser(readFileSync(path.join(dossier, fichier), "utf8")).map((c) => ({
        ...c,
        fichier,
      })),
    );
}
