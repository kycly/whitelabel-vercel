import { expect, test } from "@playwright/test";
import { SignJWT } from "jose";

const SESSION_COOKIE_NAME = "kycly_whitelabel_session";
const SESSION_SECRET = new TextEncoder().encode("playwright-session-secret");

async function createSessionToken(): Promise<string> {
  return new SignJWT({
    sub: "user-fallback-001",
    email: "demo.user@example.com",
    name: "Demo User",
    demoAccountId: "demo_001",
    canAccess: true,
    cognitoIdToken: "cognito-id-token-fallback",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(SESSION_SECRET);
}

test("replie vers logout puis login quand aucun historique fiable n'existe", async ({ baseURL, context, page }) => {
  const token = await createSessionToken();

  await page.addInitScript(() => {
    try {
      Object.defineProperty(window.history, "length", {
        configurable: true,
        get: () => 1,
      });
    } catch {
      // No-op: certains runtimes gardent cette propriete native en lecture seule.
    }
  });

  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: token,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await page.goto("/welcome");

  await expect(page.getByRole("heading", { name: "Accueil" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retour" })).toBeVisible();
  await expect.poll(async () => page.evaluate(() => window.history.length)).toBe(1);

  await page.getByRole("button", { name: "Retour" }).click();

  await page.waitForURL(/\/login$/, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();

  const cookies = await context.cookies(baseURL ? [baseURL] : undefined);
  expect(cookies.find((cookie) => cookie.name === SESSION_COOKIE_NAME)).toBeUndefined();
});