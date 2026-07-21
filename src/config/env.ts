const LOCAL_APP_ENV = "local";
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

const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? LOCAL_APP_ENV;

export const env = {
  public: {
    appEnv,
    awsRegion: process.env.NEXT_PUBLIC_AWS_REGION ?? "eu-west-1",
    cognitoAppClientId: process.env.NEXT_PUBLIC_COGNITO_APP_CLIENT_ID ?? "local-dev-client",
    cognitoUserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "eu-west-1_local",
  },
  server: {
    sessionSecret: resolveSessionSecret(appEnv),
    kyclyApiBaseUrl: resolveBaseUrl(process.env.KYCLY_API_BASE_URL, "https://api.kycly.sn"),
    kyclySessionBaseUrl: resolveBaseUrl(
      process.env.KYCLY_SESSION_BASE_URL,
      process.env.KYCLY_API_BASE_URL,
      "https://api.kycly.sn",
    ),
    kyclyMeBaseUrl: resolveBaseUrl(
      process.env.KYCLY_ME_BASE_URL,
      process.env.KYCLY_API_BASE_URL,
      "https://api.kycly.sn",
    ),
    defaultKycLinkTheme: process.env.DEFAULT_KYCLINK_THEME ?? "kycly-light",
    // Service token Cloudflare Access pour débloquer les appels serveur vers partner-node
    // (voir src/config/partner-access.ts). Optionnels : absents = aucun en-tête ajouté.
    cfAccessClientId: process.env.CF_ACCESS_CLIENT_ID,
    cfAccessClientSecret: process.env.CF_ACCESS_CLIENT_SECRET,
  },
} as const;