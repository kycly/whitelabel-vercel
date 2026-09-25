/**
 * Le classement des retards de branche, éprouvé sur le cas qui l'a motivé.
 *
 * `branch-drift.yml` disait déjà QU'une branche est en retard. Il ne disait pas si ce
 * retard contenait un correctif de sécurité ou un bump de `vitest` — et la production de
 * whitelabel a porté 2 avis critiques et 3 hauts pendant deux jours au même niveau de
 * signal qu'un paquet de test.
 */
import { describe, it, expect } from "vitest";
import {
  natureDuChemin,
  natureDuManifeste,
  classerDerive,
} from "../drift-classification.mjs";

describe("la nature d'un chemin", () => {
  it("classe le code livré en exécution", () => {
    for (const chemin of [
      "apps/regula-api/src/lambdas/kyclink/access.ts",
      "lib/constructs/dns-resources.ts",
      "packages/core/src/utils/mask-sensitive.ts",
      "app/page.tsx",
      "migrations/012_add_column.sql",
      "cdk.json",
      "Dockerfile",
      "next.config.ts",
    ]) {
      expect(natureDuChemin(chemin), chemin).toBe("runtime");
    }
  });

  it("classe la fabrication en dev", () => {
    for (const chemin of [
      ".github/workflows/ci.yml",
      "docs/runbooks/publish.md",
      "README.md",
      "packages/core/src/__tests__/domains.test.ts",
      "src/lib/http.test.ts",
      "scripts/check-fail-open.mjs",
      "vitest.config.ts",
      "next-env.d.ts",
    ]) {
      expect(natureDuChemin(chemin), chemin).toBe("dev");
    }
  });

  it("donne la priorité à `dev` sur `runtime` pour un test vivant sous `src/`", () => {
    // Sans cette priorité, tout fichier de test serait classé exécution : ils vivent dans
    // les mêmes dossiers que le code qu'ils éprouvent.
    expect(natureDuChemin("packages/core/src/__tests__/domains.test.ts")).toBe(
      "dev",
    );
    expect(natureDuChemin("apps/regula-api/src/lambdas/access.test.ts")).toBe(
      "dev",
    );
  });

  it("déclare un lockfile NEUTRE, ni l'un ni l'autre", () => {
    // Le classer exécution ferait escalader chaque montée de `devDependency` ; le classer
    // fabrication masquerait une montée de dépendance d'exécution. Il n'est jamais la
    // cause, toujours la conséquence.
    expect(natureDuChemin("pnpm-lock.yaml")).toBe("neutre");
    expect(natureDuChemin("package-lock.json")).toBe("neutre");
  });

  it("rend `null` sur un `package.json` : son chemin ne suffit pas", () => {
    expect(natureDuChemin("package.json")).toBeNull();
    expect(natureDuChemin("packages/core/package.json")).toBeNull();
  });

  it("rend `null` — et non `dev` — sur un chemin qu'il ne sait pas ranger", () => {
    // Un fichier inconnu rangé d'office en fabrication serait exactement le repli qui fait
    // passer un défaut. L'appelant le NOMME.
    expect(natureDuChemin("terraform/main.tf")).toBeNull();
  });
});

describe("la nature d'un changement de `package.json`", () => {
  const base = {
    version: "1.0.0",
    dependencies: { zod: "^3.24.0" },
    devDependencies: { vitest: "^4.1.11" },
  };

  it("ÉCHOUE sur le cas whitelabel : une montée de dépendance d'exécution", () => {
    expect(
      natureDuManifeste(base, { ...base, dependencies: { zod: "^3.25.0" } }),
    ).toBe("runtime");
  });

  it("classe une montée de `devDependency` en fabrication", () => {
    // C'est le cas `vitest` que la production de whitelabel affichait au même niveau que
    // ses 2 critiques. Il ne tourne jamais en production.
    expect(
      natureDuManifeste(base, {
        ...base,
        devDependencies: { vitest: "^4.2.0" },
      }),
    ).toBe("dev");
  });

  it("classe un `pnpm.overrides` en exécution", () => {
    // Un override impose une version à TOUT l'arbre, y compris à l'exécution.
    expect(
      natureDuManifeste(base, {
        ...base,
        pnpm: { overrides: { undici: ">=8.1.0" } },
      }),
    ).toBe("runtime");
  });

  it("ne fait PAS escalader un bump de `version` seul", () => {
    // Mesuré le 2026-09-25 : inclure `version` faisait escalader @kycly/db et
    // @kycly/react sur un retard qui ne portait que leur numéro, et noyait le seul vrai
    // signal. Le contenu d'un paquet vit sous `packages/*/src/`, déjà classé exécution.
    expect(natureDuManifeste(base, { ...base, version: "1.1.0" })).toBe("dev");
  });
});

describe("le verdict d'ensemble", () => {
  it("escalade dès un seul fichier d'exécution", () => {
    const verdict = classerDerive([
      { chemin: "package.json", nature: "runtime" },
      { chemin: "README.md", nature: "dev" },
      { chemin: "pnpm-lock.yaml", nature: "neutre" },
    ]);

    expect(verdict.escalade).toBe(true);
    expect(verdict.verdict).toContain("ESCALADE");
    expect(verdict.runtime).toEqual(["package.json"]);
    expect(verdict.neutres).toEqual(["pnpm-lock.yaml"]);
  });

  it("signale sans escalader un retard purement de fabrication", () => {
    const verdict = classerDerive([
      { chemin: ".github/workflows/ci.yml", nature: "dev" },
      { chemin: "docs/runbooks/publish.md", nature: "dev" },
    ]);

    expect(verdict.escalade).toBe(false);
    expect(verdict.verdict).toContain("SIGNALE");
  });

  it("annonce les non classés dans son verdict, sans les taire", () => {
    const verdict = classerDerive([
      { chemin: "README.md", nature: "dev" },
      { chemin: "terraform/main.tf", nature: null },
    ]);

    expect(verdict.escalade).toBe(false);
    expect(verdict.verdict).toContain("1 non classé");
    expect(verdict.inconnus).toEqual(["terraform/main.tf"]);
  });
});
