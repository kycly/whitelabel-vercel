## Objet

Decrire en une phrase le changement apporte et la raison du lot.

## Type de changement

- [ ] correction
- [ ] evolution UX/UI
- [ ] refactor technique
- [ ] documentation
- [ ] CI/CD ou ops

## Portee

- branche cible attendue: `main` ou `production`
- environnement concerne: `Preview`, `Production`, ou les deux
- impact metier: confirmer que l'application reste `sandbox-only`

## Verification

- [ ] `pnpm test`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm build`
- [ ] preview Vercel verifiee si l'UI ou l'auth sont touchees

## Controle deployment

- [ ] aucune `ck_live_*`
- [ ] `KYCLY_API_BASE_URL` vise toujours `partner-node sandbox` pour `/kyclink/*`
- [ ] `KYCLY_ME_BASE_URL` vise l'hote exposant `/demo/me`
- [ ] callbacks Cognito inchanges ou explicitement verifies
- [ ] pas de push direct sur `production`

## Liens utiles

- preview Vercel:
- issue ou ticket:
- doc impactee:

## Notes reviewer

Points a verifier en priorite pour le merge.