import { expect, test } from "@playwright/test";
import { SignJWT } from "jose";

const SESSION_COOKIE_NAME = "kycly_whitelabel_session";
const SESSION_SECRET = new TextEncoder().encode("playwright-session-secret");
const SESSION_ID = "sess_smoke_001";

async function createSessionToken(): Promise<string> {
  return new SignJWT({
    sub: "user-smoke-001",
    email: "demo.user@example.com",
    name: "Demo User",
    demoAccountId: "demo_001",
    canAccess: true,
    cognitoIdToken: "cognito-id-token-smoke",
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
        kyclinkUrl: "https://example.test/kyclink/session/sess_smoke_001",
        expiresAt: "2026-05-18T12:00:00.000Z",
      }),
    });
  });

  await page.route(`**/api/kyc/session/${SESSION_ID}/result`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessionId: SESSION_ID,
        externalId: "cust_smoke_001",
        status: "completed",
        completed: true,
        completedAt: "2026-05-18T12:03:00.000Z",
        workflowStatus: "APPROVED",
      }),
    });
  });

  await page.route(`**/api/kyc/session/${SESSION_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessionId: SESSION_ID,
        externalId: "cust_smoke_001",
        kyclinkUrl: "https://example.test/kyclink/session/sess_smoke_001",
        status: "processing",
        expiresAt: "2099-05-18T12:00:00.000Z",
        completedAt: null,
        workflowStatus: "IN_REVIEW",
        sessionState: "ACTIVE",
        resumeAvailable: true,
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
            externalId: "cust_smoke_001",
            status: "processing",
            completed: false,
            completedAt: null,
            expiresAt: "2099-05-18T12:00:00.000Z",
            createdAt: "2026-05-18T12:00:00.000Z",
            workflowStatus: "IN_REVIEW",
          },
        ],
        meta: {
          returned: 1,
          limit: 20,
          offset: 0,
          total: 1,
          statusCounts: {
            all: 1,
            pending: 0,
            processing: 1,
            completed: 0,
          },
          workflowCounts: {
            all: 1,
            PENDING: 0,
            IN_REVIEW: 1,
            ESCALATED: 0,
            APPROVED: 0,
            REJECTED: 0,
          },
        },
      }),
    });
  });
});

test("traverse le tunnel principal jusqu'au resultat avec session mockee", async ({ page }) => {
  await page.goto("/welcome");

  await expect(page.getByRole("heading", { name: "Accueil" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retour" })).toHaveCount(0);
  await page.getByRole("link", { name: /Commencer/i }).click();

  await expect(page).toHaveURL(/\/verify$/);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Contexte de vérification")).toBeVisible();
  await page.getByRole("button", { name: "Retour" }).click();
  await expect(page).toHaveURL(/\/welcome$/);

  await page.getByRole("link", { name: /Commencer/i }).click();
  await expect(page).toHaveURL(/\/verify$/);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Contexte de vérification")).toBeVisible();
  await page.getByRole("button", { name: "Générer un external ID" }).click();
  await expect(page.getByPlaceholder("cust_0042")).toHaveValue(/[A-Z2-9]{8}/);

  await page.getByPlaceholder("+221771234567").fill("+221771234567");
  await page.getByRole("button", { name: "Créer la session" }).click();

  await page.waitForURL(/\/verify\/prepare$/, { timeout: 30_000 });
  await page.waitForURL(new RegExp(`/verify/session\\?sessionId=${SESSION_ID}$`), { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Parcours" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retour" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Déconnexion" })).toHaveCount(0);

  await page.goto(`/complete?sessionId=${SESSION_ID}`);
  await expect(page.getByRole("heading", { name: "Résultat" })).toBeVisible();

  await page.getByRole("button", { name: "Actualiser" }).click();

  await expect(page.getByText("workflowStatus: APPROVED")).toBeVisible();
  await expect(page.getByText("status: completed")).toBeVisible();
  await expect(page.getByRole("link", { name: "Retour accueil" })).toBeVisible();

  await page.goto("/sessions");
  await expect(page.getByRole("heading", { name: "Historique" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Reprendre" })).toBeVisible();
  await page.getByRole("button", { name: "Retour" }).click();
  await expect(page).toHaveURL(/\/welcome$/);
});