import { LOCAL_APP_ENV, publicEnv } from "@/config/public-env";

const LOCAL_DEV_SESSION_SECRET = "local-dev-session-secret-change-me";

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function resolveBaseUrl(...values: Array<string | undefined>): string {
  const selected = values.find((value) => typeof value === "string" && value.trim().length > 0);
  return normalizeBaseUrl(selected ?? "https://api.kycly.sn");
}

function resolveSessionSecret(appEnv: string): string {
  const configuredSecret = process.env.APP_SESSION_SECRET?.trim();

  if (configuredSecret && configuredSecret !== "replace-with-a-long-random-secret") {
    return configuredSecret;
  }

  if (appEnv === LOCAL_APP_ENV) {
    return LOCAL_DEV_SESSION_SECRET;
  }

  throw new Error("APP_SESSION_SECRET must be set to a non-placeholder value outside local.");
}

export const env = {
  public: publicEnv,
  server: {
    sessionSecret: resolveSessionSecret(publicEnv.appEnv),
    appCanonicalOrigin: process.env.APP_CANONICAL_ORIGIN?.trim() || null,
    // Hôte unique partner-node : un seul base URL, appelé avec l'endpoint voulu à chaque fois
    // (`/demo/me`, `/kyclink/create`, `/kyclink/{id}`, `/kyclink/{id}/result`, `/kyclink/sessions`).
    kyclyBaseUrl: resolveBaseUrl(process.env.KYCLY_BASE_URL, "https://api.kycly.sn"),
    defaultKycLinkTheme: process.env.DEFAULT_KYCLINK_THEME ?? "kycly-light",
    // Service token Cloudflare Access pour débloquer les appels serveur vers partner-node
    // (voir src/config/partner-access.ts). Optionnels : absents = aucun en-tête ajouté.
    cfAccessClientId: process.env.CF_ACCESS_CLIENT_ID,
    cfAccessClientSecret: process.env.CF_ACCESS_CLIENT_SECRET,
  },
} as const;