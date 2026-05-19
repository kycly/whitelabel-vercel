import { expect, test } from "@playwright/test";
import { SignJWT } from "jose";

const SESSION_COOKIE_NAME = "kycly_whitelabel_session";
const SESSION_SECRET = new TextEncoder().encode("playwright-session-secret");
const SESSION_ID = "sess_mobile_001";

async function createSessionToken(): Promise<string> {
  return new SignJWT({
    sub: "user-mobile-001",
    email: "demo.user@example.com",
    name: "Demo User",
    demoAccountId: "demo_001",
    canAccess: true,
    cognitoIdToken: "cognito-id-token-mobile",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(SESSION_SECRET);
}

test.beforeEach(async ({ context, baseURL, page }) => {
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

  await page.route("**/api/kyc/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessionId: SESSION_ID,
        kyclinkUrl: "https://example.test/kyclink/session/sess_mobile_001",
        expiresAt: "2026-05-18T12:00:00.000Z",
      }),
    });
  });

  await page.route("**/api/kyc/sessions?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            sessionId: SESSION_ID,
            externalId: "cust_mobile_001",
            status: "pending",
            completed: false,
            completedAt: null,
            expiresAt: "2026-05-18T12:00:00.000Z",
            createdAt: "2026-05-18T11:50:00.000Z",
            validationStatus: null,
          },
        ],
        meta: {
          returned: 1,
          limit: 20,
          offset: 0,
          total: 1,
          statusCounts: {
            all: 1,
            pending: 1,
            processing: 0,
            completed: 0,
          },
          decisionCounts: {
            all: 1,
            APPROVED: 0,
            REJECTED: 0,
            REVIEW: 0,
          },
        },
      }),
    });
  });

  await page.route(`**/api/kyc/session/${SESSION_ID}/result`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessionId: SESSION_ID,
        externalId: "cust_mobile_001",
        status: "completed",
        completed: true,
        completedAt: "2026-05-18T12:03:00.000Z",
        validationStatus: "APPROVED",
      }),
    });
  });
});

test("verifie le tunnel protege en mobile avec proportions stables", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/welcome");
  await expect(page.getByRole("heading", { name: "Accueil" })).toBeVisible();

  const welcomeCta = page.getByRole("link", { name: "Commencer" });
  await expect(welcomeCta).toBeVisible();
  expect((await welcomeCta.boundingBox())?.height).toBe(56);

  await welcomeCta.click();
  await expect(page).toHaveURL(/\/verify$/);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Contexte de vérification")).toBeVisible();

  for (const label of ["Contexte métier", "Contexte routage", "Email", "Contexte libre"]) {
    await page.getByRole("checkbox", { name: label }).check();
  }

  await page.getByPlaceholder("cust_0042").fill("cust_mobile_001");
  await page.getByPlaceholder("+221771234567").fill("+221771234567");

  const addPairButton = page.getByRole("button", { name: "Ajouter une paire" });
  for (let index = 0; index < 3; index += 1) {
    await addPairButton.click();
  }

  const keyInputs = page.getByPlaceholder("Clé");
  const valueInputs = page.getByPlaceholder("Valeur");
  await expect(keyInputs).toHaveCount(4);

  for (let index = 0; index < 4; index += 1) {
    await keyInputs.nth(index).fill(`k${index + 1}`);
    await valueInputs.nth(index).fill(`v${index + 1}`);
  }

  const createSessionButton = page.getByRole("button", { name: "Créer la session" });
  await createSessionButton.scrollIntoViewIfNeeded();
  expect((await createSessionButton.boundingBox())?.height).toBe(56);

  await createSessionButton.click();
  await page.waitForURL(/\/verify\/prepare$/, { timeout: 30_000 });
  await page.waitForURL(new RegExp(`/verify/session\\?sessionId=${SESSION_ID}$`), { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Parcours" })).toBeVisible();

  await page.goto("/sessions");
  await expect(page.getByRole("heading", { name: "Historique" })).toBeVisible();
  await expect(page.getByText("cust_mobile_001")).toBeVisible();
  expect((await page.getByRole("button", { name: "Actualiser" }).boundingBox())?.height).toBe(44);
  expect((await page.getByRole("link", { name: "Nouvelle vérification" }).boundingBox())?.height).toBe(44);

  await page.getByRole("link", { name: /Voir la session cust_mobile_001/ }).click();
  await page.waitForURL(new RegExp(`/complete\\?sessionId=${SESSION_ID}$`), { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Résultat" })).toBeVisible();

  const refreshResultButton = page.getByRole("button", { name: "Actualiser" });
  expect((await refreshResultButton.boundingBox())?.height).toBe(44);
  await refreshResultButton.click();

  await expect(page.getByText("Validation APPROVED")).toBeVisible();
  await expect(page.getByText("APPROVED", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Retour accueil" })).toBeVisible();
});