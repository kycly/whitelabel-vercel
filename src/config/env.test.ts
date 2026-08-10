import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * ENV-057 — l'URL du runtime partner est exigee, sans repli.
 *
 * Le module calcule ses constantes a l'import : c'est le seul moment ou le
 * garde s'exerce, donc chaque cas recharge le module.
 */

const BASE_ENV = {
  NEXT_PUBLIC_APP_ENV: "local",
  APP_SESSION_SECRET: "un-secret-de-test-suffisamment-long",
};

async function chargerEnv(overrides: Record<string, string | undefined>) {
  for (const [cle, valeur] of Object.entries({ ...BASE_ENV, ...overrides })) {
    vi.stubEnv(cle, valeur ?? "");
  }
  vi.resetModules();
  return import("@/config/env");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("env — KYCLY_BASE_URL est exigee (ENV-057)", () => {
  it("prend la valeur fournie", async () => {
    const { env } = await chargerEnv({
      KYCLY_BASE_URL: "https://sandbox.partner.test",
    });
    expect(env.server.kyclyBaseUrl).toBe("https://sandbox.partner.test");
  });

  it("retire le / final", async () => {
    const { env } = await chargerEnv({
      KYCLY_BASE_URL: "https://sandbox.partner.test/",
    });
    expect(env.server.kyclyBaseUrl).toBe("https://sandbox.partner.test");
  });

  it("leve quand la variable est absente", async () => {
    // Avant, ce cas rendait `https://api.kycly.sn` — un domaine qui ne resout
    // pas. L'application ne cassait pas : elle appelait une adresse morte.
    await expect(chargerEnv({ KYCLY_BASE_URL: undefined })).rejects.toThrow(
      /KYCLY_BASE_URL must be set/,
    );
  });

  it("leve quand la variable est blanche", async () => {
    await expect(chargerEnv({ KYCLY_BASE_URL: "   " })).rejects.toThrow(
      /KYCLY_BASE_URL must be set/,
    );
  });

  it("le message ne souffle aucune URL de repli", async () => {
    const erreur = await chargerEnv({ KYCLY_BASE_URL: undefined }).catch(
      (e: Error) => e,
    );
    expect(String(erreur)).not.toMatch(/https:\/\//);
  });
});
