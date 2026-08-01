import { expect, test } from "@playwright/test";
import { SignJWT } from "jose";

const SESSION_COOKIE_NAME = "kycly_whitelabel_session";
const SESSION_SECRET = new TextEncoder().encode("playwright-session-secret");

async function createSessionToken(): Promise<string> {
  return new SignJWT({
    sub: "user-search-001",
    email: "demo.user@example.com",
    name: "Demo User",
    demoAccountId: "demo_001",
    canAccess: true,
    cognitoIdToken: "cognito-id-token-search",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(SESSION_SECRET);
}

/** Toutes les URL de liste appelees par l'ecran, dans l'ordre. */
const calls: string[] = [];

test.beforeEach(async ({ context, baseURL, page }) => {
  calls.length = 0;

  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: await createSessionToken(),
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await page.route("**/api/kyc/sessions?**", async (route) => {
    calls.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [],
        meta: {
          returned: 0,
          limit: 20,
          offset: 0,
          total: 0,
          statusCounts: { all: 0, pending: 0, processing: 0, completed: 0 },
          workflowCounts: {
            all: 0,
            PENDING: 0,
            IN_REVIEW: 0,
            ESCALATED: 0,
            APPROVED: 0,
            REJECTED: 0,
          },
        },
      }),
    });
  });
});

test("la recherche n appelle l amont qu a la soumission", async ({ page }) => {
  await page.goto("/sessions");
  await expect.poll(() => calls.length).toBeGreaterThan(0);
  const initial = calls.length;

  const champ = page.getByLabel("Rechercher une verification");

  // Aucune requete pendant la frappe : c'est tout l'objet de l'application explicite.
  await champ.fill("kane");
  await page.waitForTimeout(500);
  expect(calls.length).toBe(initial);

  await champ.press("Enter");
  await expect.poll(() => calls.length).toBe(initial + 1);
  expect(calls[calls.length - 1]).toContain("q=kane");
});

test("les filtres sont replies par defaut", async ({ page }) => {
  await page.goto("/sessions");
  await expect.poll(() => calls.length).toBeGreaterThan(0);

  // `exact` est indispensable : sans lui, « Filtrer par statut » matche aussi
  // « Filtrer par statut metier » et Playwright refuse les deux resultats.
  const menuStatut = page.getByLabel("Filtrer par statut", { exact: true });

  await expect(menuStatut).toBeHidden();
  await page.getByLabel("Filtres").click();
  await expect(menuStatut).toBeVisible();
  await expect(page.getByLabel("Filtrer par periode")).toBeVisible();
});
