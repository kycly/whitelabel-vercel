import { expect, test } from "@playwright/test";
import { SignJWT } from "jose";

const SESSION_COOKIE_NAME = "kycly_whitelabel_session";
const SESSION_SECRET = new TextEncoder().encode("playwright-session-secret");
const SESSION_ID = "sess_expired_001";

async function createSessionToken(): Promise<string> {
  return new SignJWT({
    sub: "user-expired-001",
    email: "demo.user@example.com",
    name: "Demo User",
    demoAccountId: "demo_001",
    canAccess: true,
    cognitoIdToken: "expired-cognito-id-token",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(SESSION_SECRET);
}

async function expectLoginAndClearedCookie(params: {
  page: import("@playwright/test").Page;
  context: import("@playwright/test").BrowserContext;
  baseURL: string | undefined;
}): Promise<void> {
  await params.page.waitForURL(/\/login$/, { timeout: 30_000 });
  await expect(params.page.getByRole("button", { name: "Se connecter" })).toBeVisible();

  const cookies = await params.context.cookies(params.baseURL ? [params.baseURL] : undefined);
  expect(cookies.find((cookie) => cookie.name === SESSION_COOKIE_NAME)).toBeUndefined();
}

test.beforeEach(async ({ context, baseURL }) => {
  const token = await createSessionToken();

  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: token,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
});

test("logout automatiquement depuis l'historique quand Cognito est expire", async ({ page, context, baseURL }) => {
  await page.route("**/api/kyc/sessions?**", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      headers: {
        "set-cookie": `${SESSION_COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`,
      },
      body: JSON.stringify({
        message: "Unauthorized.",
        code: "UNAUTHORIZED",
      }),
    });
  });

  await page.goto("/sessions");

  await expectLoginAndClearedCookie({ page, context, baseURL });
});

test("logout automatiquement depuis le resultat quand Cognito est expire", async ({ page, context, baseURL }) => {
  await page.route(`**/api/kyc/session/${SESSION_ID}/result`, async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      headers: {
        "set-cookie": `${SESSION_COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`,
      },
      body: JSON.stringify({
        message: "Unauthorized.",
        code: "UNAUTHORIZED",
      }),
    });
  });

  await page.goto(`/complete?sessionId=${SESSION_ID}`);
  await expect(page.getByRole("heading", { name: "Résultat" })).toBeVisible();

  await page.getByRole("button", { name: "Actualiser" }).click();

  await expectLoginAndClearedCookie({ page, context, baseURL });
});