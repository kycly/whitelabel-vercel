type DemoAccountKeyMap = Record<string, string>;

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function parseDemoAccountKeyMap(raw: string | undefined): DemoAccountKeyMap {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const entries = Object.entries(parsed).filter((entry): entry is [string, string] => {
      return typeof entry[0] === "string" && typeof entry[1] === "string";
    });

    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

export const env = {
  public: {
    appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "local",
    awsRegion: process.env.NEXT_PUBLIC_AWS_REGION ?? "eu-west-1",
    cognitoAppClientId: process.env.NEXT_PUBLIC_COGNITO_APP_CLIENT_ID ?? "local-dev-client",
    cognitoUserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "eu-west-1_local",
  },
  server: {
    sessionSecret: process.env.APP_SESSION_SECRET ?? "local-dev-session-secret-change-me",
    kyclyApiBaseUrl: normalizeBaseUrl(process.env.KYCLY_API_BASE_URL ?? "https://api.kycly.sn"),
    kyclyMeBaseUrl: normalizeBaseUrl(
      process.env.KYCLY_ME_BASE_URL ?? process.env.KYCLY_API_BASE_URL ?? "https://api.kycly.sn",
    ),
    demoAccountKeyMap: parseDemoAccountKeyMap(process.env.DEMO_ACCOUNT_KEY_MAP),
    defaultKycLinkTheme: process.env.DEFAULT_KYCLINK_THEME ?? "kycly-light",
  },
} as const;

export function getDemoAccountApiKey(demoAccountId: string): string | null {
  return env.server.demoAccountKeyMap[demoAccountId] ?? null;
}