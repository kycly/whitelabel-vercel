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
  let kycSessionCallCount = 0;
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

  await page.route(`**/api/kyc/session/${SESSION_ID}`, async (route) => {
    kycSessionCallCount += 1;
    // Le premier appel sert la gate de reprise (session jamais soumise, le widget doit
    // s'afficher) ; les suivants servent l'ecran de resultat, decision rendue.
    const isFreshlyCreated = kycSessionCallCount === 1;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessionId: SESSION_ID,
        externalId: "cust_smoke_001",
        kyclinkUrl: "https://example.test/kyclink/session/sess_smoke_001",
        status: isFreshlyCreated ? "pending" : "completed",
        expiresAt: "2099-05-18T12:00:00.000Z",
        completedAt: isFreshlyCreated ? null : "2026-05-18T12:03:00.000Z",
        workflowStatus: isFreshlyCreated ? null : "APPROVED",
        sessionState: isFreshlyCreated ? "ACTIVE" : "COMPLETED",
        resumeAvailable: isFreshlyCreated,
      }),
    });
  });

  await page.route(`**/api/kyc/session/${SESSION_ID}/detail`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ocrFront: { firstName: "Demo", lastName: "Smoke" },
        ocrBack: {},
        faceSimilarity: 0.97,
        validationScore: 0.92,
        imageSides: [],
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
            completedAt: null,
            expiresAt: "2099-05-18T12:00:00.000Z",
            createdAt: "2026-05-18T12:00:00.000Z",
            workflowStatus: "IN_REVIEW",
            sessionState: "ACTIVE",
            resumeAvailable: true,
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
  await expect(page.getByPlaceholder("cust_0042")).toHaveValue(/KYCLY_[A-Z2-9]{8}/);

  await page.getByPlaceholder("+221771234567").fill("+221771234567");
  await page.getByRole("button", { name: "Créer la session" }).click();

  await page.waitForURL(/\/verify\/prepare$/, { timeout: 30_000 });
  await page.waitForURL(new RegExp(`/verify/session\\?sessionId=${SESSION_ID}$`), { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Parcours" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retour" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Déconnexion" })).toHaveCount(0);

  await page.goto(`/sessions/${SESSION_ID}`);
  await expect(page.getByRole("heading", { name: "Détail de la vérification" })).toBeVisible();

  await expect(page.getByText("APPROVED")).toBeVisible();
  await expect(page.getByText("92 %")).toBeVisible();
  await expect(page.getByText("97 %")).toBeVisible();
  await expect(page.getByRole("link", { name: "Retour accueil" })).toBeVisible();

  await page.goto("/sessions");
  await expect(page.getByRole("heading", { name: "Historique" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Reprendre" })).toBeVisible();
  await page.getByRole("button", { name: "Retour" }).click();
  await expect(page).toHaveURL(/\/welcome$/);
});