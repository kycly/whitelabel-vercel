# Codebase Auto-Generated Reference

> Source unique: analyse statique du code.
> Ce fichier est auto-genere. Ne pas modifier manuellement.

- Repo: @kycly/whitelabel-vercel
- Generation: deterministic (no timestamp)
- Racines scannees: app, src, scripts

## Resume

| Metrique | Valeur |
|---|---:|
| Fichiers code scannes | 86 |
| Routes detectees | 23 |
| Hooks detectes | 0 |
| Composants detectes | 22 |
| Exports detectes | 153 |
| Fichiers de tests detectes | 13 |
| Variables d'environnement detectees | 10 |

## Scripts npm/pnpm (package.json)

| Script | Commande |
|---|---|
| dev | next dev |
| build | next build |
| start | next start |
| lint | eslint . |
| typecheck | tsc --noEmit |
| test | vitest run |
| test:e2e | playwright test |
| docs:check | node scripts/check-doc-drift.mjs |
| guard:sandbox-only | node scripts/check-sandbox-only.mjs |
| prepare | node scripts/install-githooks.mjs |
| docs:codegen | node scripts/generate-code-docs.mjs |
| docs:codegen:check | node scripts/check-code-docs.mjs |
| docs:truth | node scripts/check-doc-truth.mjs |
| docs:structure | node scripts/check-doc-structure.mjs |
| docs:freshness | node scripts/check-doc-freshness.mjs |

## Variables d'environnement (detectees dans le code)

- APP_CANONICAL_ORIGIN
- APP_SESSION_SECRET
- CF_ACCESS_CLIENT_ID
- CF_ACCESS_CLIENT_SECRET
- DEFAULT_KYCLINK_THEME
- KYCLY_BASE_URL
- NEXT_PUBLIC_APP_ENV
- NEXT_PUBLIC_AWS_REGION
- NEXT_PUBLIC_COGNITO_APP_CLIENT_ID
- NEXT_PUBLIC_COGNITO_USER_POOL_ID

## Inventaire des routes

| Type | Methode | Path | Source |
|---|---|---|---|
| next-app | PAGE | / | app/page.tsx |
| next-app | PAGE | /access-denied | app/access-denied/page.tsx |
| next-app | HTTP | /api/auth/session | app/api/auth/session/route.ts |
| next-app | HTTP | /api/kyc/session | app/api/kyc/session/route.ts |
| next-app | HTTP | /api/kyc/session/:sessionId | app/api/kyc/session/[sessionId]/route.ts |
| next-app | HTTP | /api/kyc/session/:sessionId/detail | app/api/kyc/session/[sessionId]/detail/route.ts |
| next-app | HTTP | /api/kyc/session/:sessionId/images/:side | app/api/kyc/session/[sessionId]/images/[side]/route.ts |
| next-app | HTTP | /api/kyc/session/:sessionId/result | app/api/kyc/session/[sessionId]/result/route.ts |
| next-app | HTTP | /api/kyc/sessions | app/api/kyc/sessions/route.ts |
| next-app | HTTP | /api/me | app/api/me/route.ts |
| next-app | PAGE | /auth-loading | app/auth-loading/page.tsx |
| next-app | HTTP | /auth/callback | app/auth/callback/route.ts |
| next-app | HTTP | /auth/login | app/auth/login/route.ts |
| next-app | HTTP | /auth/logout | app/auth/logout/route.ts |
| next-app | PAGE | /complete | app/complete/page.tsx |
| next-app | PAGE | /failure | app/failure/page.tsx |
| next-app | PAGE | /login | app/login/page.tsx |
| next-app | PAGE | /sessions | app/sessions/page.tsx |
| next-app | PAGE | /sessions/:sessionId | app/sessions/[sessionId]/page.tsx |
| next-app | PAGE | /verify | app/verify/page.tsx |
| next-app | PAGE | /verify/prepare | app/verify/prepare/page.tsx |
| next-app | PAGE | /verify/session | app/verify/session/page.tsx |
| next-app | PAGE | /welcome | app/welcome/page.tsx |

## Hooks

_Aucun hook detecte._

## Composants

- src/components/auth/logout-button.tsx
- src/components/layout/page-shell.tsx
- src/components/layout/protected-screen-shell.tsx
- src/components/navigation/back-icon-button.tsx
- src/components/screens/access-denied-screen.tsx
- src/components/screens/auth-loading-screen.tsx
- src/components/screens/failure-screen.tsx
- src/components/screens/login-screen.tsx
- src/components/screens/session-context-screen.tsx
- src/components/screens/welcome-screen.tsx
- src/components/ui/fixed-action-layout.ts
- src/components/ui/surface-panel.tsx
- src/components/verify/image-lightbox.tsx
- src/components/verify/image-sides.ts
- src/components/verify/verification-complete.tsx
- src/components/verify/verification-detail.tsx
- src/components/verify/verification-prepare-screen.tsx
- src/components/verify/verification-run-screen.tsx
- src/components/verify/verification-session-gate.tsx
- src/components/verify/verification-sessions.tsx
- src/components/verify/verification-workspace.tsx
- src/components/verify/workflow-status.ts

## Exports publics

| Kind | Symbol | Source |
|---|---|---|
| default | default | app/access-denied/page.tsx |
| function | POST | app/api/auth/session/route.ts |
| function | GET | app/api/kyc/session/[sessionId]/detail/route.ts |
| function | GET | app/api/kyc/session/[sessionId]/images/[side]/route.ts |
| function | GET | app/api/kyc/session/[sessionId]/result/route.ts |
| function | GET | app/api/kyc/session/[sessionId]/route.ts |
| function | POST | app/api/kyc/session/route.ts |
| function | GET | app/api/kyc/sessions/route.ts |
| function | GET | app/api/me/route.ts |
| default | default | app/auth-loading/page.tsx |
| function | GET | app/auth/callback/route.ts |
| function | GET | app/auth/login/route.ts |
| function | GET | app/auth/logout/route.ts |
| function | POST | app/auth/logout/route.ts |
| default | default | app/complete/page.tsx |
| default | default | app/failure/page.tsx |
| default | default | app/layout.tsx |
| const | metadata | app/layout.tsx |
| const | viewport | app/layout.tsx |
| default | default | app/login/page.tsx |
| default | default | app/manifest.ts |
| default | default | app/page.tsx |
| default | default | app/sessions/[sessionId]/page.tsx |
| default | default | app/sessions/page.tsx |
| default | default | app/verify/page.tsx |
| default | default | app/verify/prepare/page.tsx |
| default | default | app/verify/session/page.tsx |
| default | default | app/welcome/page.tsx |
| function | evaluateDocDrift | scripts/check-doc-drift.mjs |
| function | evaluateDocDriftForFiles | scripts/check-doc-drift.mjs |
| type | CognitoAuthResult | src/auth/cognito-client.ts |
| type | CognitoCodeDelivery | src/auth/cognito-client.ts |
| function | cognitoCompleteNewPassword | src/auth/cognito-client.ts |
| function | cognitoConfirmForgotPassword | src/auth/cognito-client.ts |
| function | cognitoSignIn | src/auth/cognito-client.ts |
| function | cognitoSignOut | src/auth/cognito-client.ts |
| function | cognitoStartForgotPassword | src/auth/cognito-client.ts |
| function | getExistingSession | src/auth/cognito-client.ts |
| function | redirectToLogout | src/auth/cognito-client.ts |
| function | getCognitoIssuer | src/auth/cognito.ts |
| function | identityFromIdTokenPayload | src/auth/cognito.ts |
| class | PartnerDemoAccessError | src/auth/cognito.ts |
| function | resolvePartnerDemoAccess | src/auth/cognito.ts |
| type | SessionClaims | src/auth/cognito.ts |
| type | VerifiedIdentityClaims | src/auth/cognito.ts |
| function | verifyCognitoIdToken | src/auth/cognito.ts |
| type | AppSession | src/auth/session.ts |
| function | clearSessionCookie | src/auth/session.ts |
| function | createSessionToken | src/auth/session.ts |
| function | readSession | src/auth/session.ts |
| function | writeSessionCookie | src/auth/session.ts |
| function | LogoutButton | src/components/auth/logout-button.tsx |
| function | PageShell | src/components/layout/page-shell.tsx |
| function | ProtectedScreenShell | src/components/layout/protected-screen-shell.tsx |
| function | BackIconButton | src/components/navigation/back-icon-button.tsx |
| function | AccessDeniedScreen | src/components/screens/access-denied-screen.tsx |
| function | AuthLoadingScreen | src/components/screens/auth-loading-screen.tsx |
| function | FailureScreen | src/components/screens/failure-screen.tsx |
| function | LoginScreen | src/components/screens/login-screen.tsx |
| function | SessionContextScreen | src/components/screens/session-context-screen.tsx |
| function | WelcomeScreen | src/components/screens/welcome-screen.tsx |
| const | checklistCardClassName | src/components/ui/fixed-action-layout.ts |
| const | destructiveIconButtonClassName | src/components/ui/fixed-action-layout.ts |
| const | errorAlertClassName | src/components/ui/fixed-action-layout.ts |
| const | errorAlertWithIconClassName | src/components/ui/fixed-action-layout.ts |
| const | featureActionCardClassName | src/components/ui/fixed-action-layout.ts |
| const | fixedFooterActionsClassName | src/components/ui/fixed-action-layout.ts |
| const | fixedFooterSafeAreaClassName | src/components/ui/fixed-action-layout.ts |
| function | formFieldClassName | src/components/ui/fixed-action-layout.ts |
| const | infoAlertClassName | src/components/ui/fixed-action-layout.ts |
| const | inlinePrimaryButtonClassName | src/components/ui/fixed-action-layout.ts |
| const | metricCardClassName | src/components/ui/fixed-action-layout.ts |
| const | primaryCtaClassName | src/components/ui/fixed-action-layout.ts |
| const | primaryIconButtonClassName | src/components/ui/fixed-action-layout.ts |
| const | scrollablePanelBodyClassName | src/components/ui/fixed-action-layout.ts |
| const | secondaryButtonClassName | src/components/ui/fixed-action-layout.ts |
| const | secondaryIconButtonClassName | src/components/ui/fixed-action-layout.ts |
| const | stepCardClassName | src/components/ui/fixed-action-layout.ts |
| const | successAlertClassName | src/components/ui/fixed-action-layout.ts |
| const | successIconButtonClassName | src/components/ui/fixed-action-layout.ts |
| const | surfaceInfoCardClassName | src/components/ui/fixed-action-layout.ts |
| const | surfaceInfoPanelClassName | src/components/ui/fixed-action-layout.ts |
| const | warningAlertClassName | src/components/ui/fixed-action-layout.ts |
| function | SurfacePanel | src/components/ui/surface-panel.tsx |
| function | ImageLightbox | src/components/verify/image-lightbox.tsx |
| function | groupImageSides | src/components/verify/image-sides.ts |
| function | VerificationComplete | src/components/verify/verification-complete.tsx |
| function | VerificationDetail | src/components/verify/verification-detail.tsx |
| function | VerificationPrepareScreen | src/components/verify/verification-prepare-screen.tsx |
| function | VerificationRunScreen | src/components/verify/verification-run-screen.tsx |
| function | VerificationSessionGate | src/components/verify/verification-session-gate.tsx |
| function | VerificationSessions | src/components/verify/verification-sessions.tsx |
| function | VerificationWorkspace | src/components/verify/verification-workspace.tsx |
| type | WorkflowStatus | src/components/verify/workflow-status.ts |
| function | workflowStatusTone | src/components/verify/workflow-status.ts |
| function | workflowStatusValue | src/components/verify/workflow-status.ts |
| const | env | src/config/env.ts |
| function | buildPartnerAccessHeaders | src/config/partner-access.ts |
| const | LOCAL_APP_ENV | src/config/public-env.ts |
| const | publicEnv | src/config/public-env.ts |
| function | handleAppError | src/lib/app-client.ts |
| function | requestInlineJson | src/lib/app-client.ts |
| function | requestProtectedJson | src/lib/app-client.ts |
| class | AppError | src/lib/app-error.ts |
| type | AppErrorAction | src/lib/app-error.ts |
| type | AppErrorCategory | src/lib/app-error.ts |
| type | AppErrorPayload | src/lib/app-error.ts |
| function | buildFailureHref | src/lib/app-error.ts |
| function | errorMessage | src/lib/app-error.ts |
| type | FailurePresentation | src/lib/app-error.ts |
| function | getAppErrorMessage | src/lib/app-error.ts |
| function | getFailurePresentation | src/lib/app-error.ts |
| function | resolveInlineAppError | src/lib/app-error.ts |
| function | resolveProtectedAppError | src/lib/app-error.ts |
| function | computeConfidenceTicks | src/lib/confidence-ticks.ts |
| function | createParentOriginHandshakeMessage | src/lib/kyclink-embed.ts |
| const | PARENT_ORIGIN_HANDSHAKE_MESSAGE_TYPE | src/lib/kyclink-embed.ts |
| function | resolveKyclinkOrigin | src/lib/kyclink-embed.ts |
| function | formatOcrLabel | src/lib/ocr-format.ts |
| function | formatSimilarityPercent | src/lib/similarity-format.ts |
| function | clearVerificationDraft | src/lib/verification-draft.ts |
| function | readVerificationDraft | src/lib/verification-draft.ts |
| function | saveVerificationDraft | src/lib/verification-draft.ts |
| function | buildSessionMetadata | src/lib/verification.ts |
| const | COUNTRY_OPTIONS | src/lib/verification.ts |
| const | defaultSessionContext | src/lib/verification.ts |
| const | MAX_CUSTOM_CONTEXT_ENTRIES | src/lib/verification.ts |
| function | normalizeExternalId | src/lib/verification.ts |
| const | NOTIFICATION_CHANNEL_OPTIONS | src/lib/verification.ts |
| const | PRIORITY_OPTIONS | src/lib/verification.ts |
| const | PRODUCT_OPTIONS | src/lib/verification.ts |
| const | SEGMENT_OPTIONS | src/lib/verification.ts |
| type | SessionContextInput | src/lib/verification.ts |
| const | sessionContextSchema | src/lib/verification.ts |
| const | VERIFICATION_TYPE_OPTIONS | src/lib/verification.ts |
| function | createKycErrorResponse | src/server/kyc-route-response.ts |
| function | createUnauthorizedKycResponse | src/server/kyc-route-response.ts |
| type | CreatedKycSession | src/server/kyclink.ts |
| function | createKycSession | src/server/kyclink.ts |
| function | fetchKycSession | src/server/kyclink.ts |
| function | fetchKycSessionResult | src/server/kyclink.ts |
| function | fetchKycSessions | src/server/kyclink.ts |
| function | fetchKycVerificationDetail | src/server/kyclink.ts |
| function | fetchKycVerificationImage | src/server/kyclink.ts |
| type | KycSession | src/server/kyclink.ts |
| class | KycSessionError | src/server/kyclink.ts |
| type | KycSessionResult | src/server/kyclink.ts |
| type | KycSessionsList | src/server/kyclink.ts |
| type | KycSessionsListQuery | src/server/kyclink.ts |
| function | parseKycSessionsListQuery | src/server/kyclink.ts |
| function | resolveParentOrigin | src/server/request-origin.ts |
| function | projectVerificationDetail | src/server/verification-detail.ts |
| type | VerificationDetail | src/server/verification-detail.ts |

## Fichiers de tests

- app/api/kyc/session/[sessionId]/detail/route.test.ts
- app/api/kyc/session/[sessionId]/images/[side]/route.test.ts
- src/auth/cognito.test.ts
- src/components/verify/image-sides.test.ts
- src/config/partner-access.test.ts
- src/lib/app-error.test.ts
- src/lib/confidence-ticks.test.ts
- src/lib/kyclink-embed.test.ts
- src/lib/ocr-format.test.ts
- src/lib/similarity-format.test.ts
- src/server/kyc-session-route.test.ts
- src/server/kyclink.test.ts
- src/server/verification-detail.test.ts

## Regeneration

```bash
pnpm docs:codegen
```

> Documentation Sync: code-derived (baseline code-only: docs/reference/CODEBASE-AUTOGEN.md)

