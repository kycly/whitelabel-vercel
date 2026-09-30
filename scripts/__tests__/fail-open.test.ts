/**
 * Le garde anti fail-open, vu échouer sur les occurrences RÉELLES.
 *
 * Chaque cas ci-dessous est copié d'un workflow du parc, dans l'état où il a été trouvé.
 * Deux d'entre eux étaient mes propres gardes : c'est la raison d'être de ce fichier — le
 * motif ne s'apprend pas, il se mécanise.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error — module .mjs sans déclarations, importé pour son comportement.
import { analyser } from "../fail-open.mjs";

type Constat = { ligne: number; motif: string };
const motifs = (texte: string) =>
  (analyser(texte) as Constat[]).map((c) => c.motif);

describe("le pas qui se saute quand une valeur manque", () => {
  it("ÉCHOUE sur le balayage CloudWatch de ci.yml, resté inopérant depuis sa création", () => {
    // Le secret AWS_ROLE_ARN n'existe qu'au niveau des ENVIRONNEMENTS. Au niveau du
    // dépôt il vaut la chaîne vide, donc cette condition était toujours fausse : le
    // balayage n'a jamais tourné, et le seul signe était un `::warning::`.
    const texte = `
      - name: CloudWatch sensitive log scan
        if: \${{ env.AWS_ROLE_ARN != '' && env.AWS_REGION != '' }}
        run: pnpm security:scan-cloudwatch-logs
`;
    expect(motifs(texte)).toContain(
      "ce pas se SAUTE quand une valeur manque, sans rien signaler",
    );
  });

  it("accepte une condition portant sur la BRANCHE, pas sur la vacuité d'un secret", () => {
    const texte = `
      - name: CloudWatch sensitive log scan
        if: \${{ env.SCAN_CLOUDWATCH == 'true' }}
        run: pnpm security:scan-cloudwatch-logs
`;
    expect(analyser(texte)).toEqual([]);
  });
});

describe("la variable absente qui n'arrête rien", () => {
  it("ÉCHOUE sur le smoke des fronts : « APP_URL non défini, smoke test ignoré »", () => {
    const texte = `
          if [ -z "\${{ vars.APP_URL }}" ]; then
            echo "APP_URL non défini, smoke test ignoré"
            exit 0
          fi
`;
    expect(motifs(texte)).toContain(
      "une valeur absente ne fait pas échouer le pas",
    );
  });

  it("accepte un `::error::` collé à son guillemet", () => {
    // Piège de regex, trouvé en portant le garde sur kyclink-node : entre `"` et `:` il
    // n'y a aucune frontière de mot. Un `\\b` en tête d'alternation faisait signaler
    // comme fail-open une boucle qui échouait correctement.
    const texte = `
          missing=0
          for name in VITE_EMBED_VALIDATE_URL VITE_EVIDENCE_BASE_URL; do
            value="\${!name}"
            if [ -z "$value" ]; then
              echo "::error::\${name} est vide."
              missing=1
            fi
          done
          [ "$missing" -eq 0 ]
`;
    expect(analyser(texte)).toEqual([]);
  });

  it("accepte le même contrôle quand il sort en échec", () => {
    const texte = `
          if [ -z "$APP_URL" ]; then
            echo "::error::APP_URL absente"
            exit 1
          fi
`;
    expect(analyser(texte)).toEqual([]);
  });
});

describe("la boucle d'attente", () => {
  it("ÉCHOUE sur la boucle MinIO dans son état d'origine", () => {
    // `curl … || sleep 2` : les 20 essais épuisés, la boucle se terminait sans bruit et
    // les tests e2e partaient contre un stockage absent.
    const texte = `
          for i in $(seq 1 20); do
            curl -sf http://localhost:9000/minio/health/live && break || sleep 2
          done
          pnpm test:e2e
`;
    expect(motifs(texte)).toContain(
      "boucle d'attente qui se termine sans échouer",
    );
  });

  it("accepte la boucle corrigée, qui échoue après le `done`", () => {
    const texte = `
          for i in $(seq 1 20); do
            if curl -sf http://localhost:9000/minio/health/live >/dev/null; then
              echo "MinIO pret apres $i essai(s)."
              exit 0
            fi
            sleep 2
          done
          echo "MinIO n'a pas repondu." >&2
          exit 1
`;
    expect(analyser(texte)).toEqual([]);
  });

  it("ne dit rien d'une boucle qui n'attend rien", () => {
    // Zéro faux positif : une boucle de traitement n'a aucune raison d'échouer à la fin.
    const texte = `
          for pkg in core db link; do
            echo "publication de $pkg"
          done
`;
    expect(analyser(texte)).toEqual([]);
  });
});

describe("les deux formes courtes", () => {
  it("ÉCHOUE sur `|| true` et sur `|| :`", () => {
    expect(motifs("          pnpm audit || true\n")).toHaveLength(1);
    expect(motifs("          pnpm audit || :\n")).toHaveLength(1);
  });

  it("ÉCHOUE sur `continue-on-error: true` sans justification, et accepte l'inverse", () => {
    expect(motifs("        continue-on-error: true\n")).toContain(
      "`continue-on-error: true` sans justification",
    );
    expect(
      analyser(
        "        # Codacy est advisory, son indisponibilité ne bloque pas.\n        continue-on-error: true\n",
      ),
    ).toEqual([]);
  });

  it("ignore une ligne commentée", () => {
    // Les commentaires de ce parc CITENT les formes fautives pour expliquer leur
    // retrait. Un garde qui échoue sur sa propre documentation se fait désactiver.
    expect(
      analyser(
        "          # Pas de `|| true` : l'echec du job EST le signal.\n",
      ),
    ).toEqual([]);
  });
});
