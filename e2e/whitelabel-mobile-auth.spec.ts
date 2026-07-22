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
        expiresAt: "2099-05-18T12:00:00.000Z",
      }),
    });
  });

  await page.route(`**/api/kyc/session/${SESSION_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessionId: SESSION_ID,
        externalId: "cust_mobile_001",
        kyclinkUrl: "https://example.test/kyclink/session/sess_mobile_001",
        status: "completed",
        expiresAt: "2099-05-18T12:00:00.000Z",
        completedAt: "2026-05-18T12:03:00.000Z",
        workflowStatus: "APPROVED",
        sessionState: "ACTIVE",
        resumeAvailable: true,
      }),
    });
  });

  await page.route(`**/api/kyc/session/${SESSION_ID}/detail`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ocrFront: { firstName: "Demo", lastName: "User" },
        ocrBack: {},
        faceSimilarity: 0.97,
        imageSides: ["recto"],
      }),
    });
  });

  const TRANSPARENT_PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );

  await page.route(`**/api/kyc/session/${SESSION_ID}/images/recto`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: TRANSPARENT_PNG,
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
            expiresAt: "2099-05-18T12:00:00.000Z",
            createdAt: "2026-05-18T11:50:00.000Z",
            workflowStatus: null,
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
          workflowCounts: {
            all: 1,
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
        workflowStatus: "APPROVED",
      }),
    });
  });
});

test("verifie le tunnel protege en mobile avec proportions stables", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/welcome");
  await expect(page.getByRole("heading", { name: "Accueil" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retour" })).toHaveCount(0);

  const welcomeCta = page.getByRole("link", { name: "Commencer" });
  await expect(welcomeCta).toBeVisible();
  expect((await welcomeCta.boundingBox())?.height).toBe(56);

  await welcomeCta.click();
  await expect(page).toHaveURL(/\/verify$/);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Contexte de vérification")).toBeVisible();
  await page.getByRole("button", { name: "Retour" }).click();
  await expect(page).toHaveURL(/\/welcome$/);

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
  await expect(page.getByRole("heading", { name: "Parcours" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retour" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Déconnexion" })).toHaveCount(0);

  await page.goto("/sessions");
  await expect(page.getByRole("heading", { name: "Historique" })).toBeVisible();
  await expect(page.getByText("cust_mobile_001")).toBeVisible();
  await expect(page.getByText("TRAIT. EN COURS")).toBeVisible();
  await expect(page.getByRole("link", { name: "Reprendre" })).toBeVisible();
  expect((await page.getByRole("button", { name: "Actualiser" }).boundingBox())?.height).toBe(44);
  expect((await page.getByRole("link", { name: "Nouvelle vérification" }).boundingBox())?.height).toBe(44);
  await page.getByRole("button", { name: "Retour" }).click();
  await expect(page).toHaveURL(/\/welcome$/);

  await page.goto("/sessions");
  await expect(page.getByRole("heading", { name: "Historique" })).toBeVisible();

  await page.getByRole("link", { name: /Voir le résultat/i }).click();
  await page.waitForURL(new RegExp(`/sessions/${SESSION_ID}$`), { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Détail de la vérification" })).toBeVisible();

  await expect(page.getByText("APPROVED")).toBeVisible();
  await expect(page.getByText("cust_mobile_001")).toBeVisible();
  await expect(page.getByText("Demo")).toBeVisible();
  await expect(page.getByText("97 %")).toBeVisible();

  await page.getByRole("button", { name: "recto" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Fermer" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("fait defiler la page contexte quand des champs optionnels apparaissent", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/verify");
  await expect(page).toHaveURL(/\/verify$/);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Contexte de vérification")).toBeVisible();

  for (const label of ["Contexte métier", "Contexte routage", "Email", "Contexte libre"]) {
    await page.getByRole("checkbox", { name: label }).check();
  }

  const addPairButton = page.getByRole("button", { name: "Ajouter une paire" });
  for (let index = 0; index < 3; index += 1) {
    await addPairButton.click();
  }

  const scrollContainer = page.getByTestId("session-context-scroll-body");
  const layoutMetrics = await page.evaluate(() => {
    const main = document.querySelector("main");

    return {
      viewportHeight: window.innerHeight,
      documentHeight: document.documentElement.scrollHeight,
      mainOverflowY: main ? getComputedStyle(main).overflowY : null,
    };
  });

  const scrollContainerMetrics = await scrollContainer.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
    overflowY: getComputedStyle(element).overflowY,
  }));

  expect(layoutMetrics.documentHeight).toBe(layoutMetrics.viewportHeight);
  expect(layoutMetrics.mainOverflowY).toBe("hidden");
  expect(scrollContainerMetrics.scrollHeight).toBeGreaterThan(scrollContainerMetrics.clientHeight);
  expect(scrollContainerMetrics.overflowY).toBe("auto");

  const createSessionButton = page.getByRole("button", { name: "Créer la session" });
  await expect(createSessionButton).toBeVisible();

  await scrollContainer.evaluate((element) => {
    element.scrollTo({ top: element.scrollHeight, behavior: "instant" });
  });

  await expect
    .poll(async () => scrollContainer.evaluate((element) => element.scrollTop), {
      timeout: 5_000,
    })
    .toBeGreaterThan(0);
});