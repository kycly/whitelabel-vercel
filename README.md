# whitelabel-vercel

Scaffold cible pour une application web de demonstration / whitelabel autour de @kycly/link.

Le scope retenu a ce stade est volontairement simple:

- application independante pour son frontend, son backend applicatif, son deploiement et ses secrets
- dependance de service assumee a partner-node au J1 pour la creation canonique des sessions KYC
- application demo branchee sur le runtime sandbox de partner-node, y compris quand elle est deployee en preview ou en production sur Vercel
- frontend et backend deploiement separes de partner-node
- meme user pool Cognito que partner-node
- client Cognito dedie a cette application
- creation de sessions uniquement cote serveur avec des cles ck_demo_*
- aucun acces direct a la base ou au backend runtime de partner-node
- aucune base dediee au J1
- meme langage esthetique UI/UX que integration-node, mais redefini localement dans ce projet

Documentation de cadrage:

- blueprint principal: [docs/BLUEPRINT.md](docs/BLUEPRINT.md)
- decisions fermees J1: [docs/DECISIONS-J1.md](docs/DECISIONS-J1.md)
- parcours J1: [docs/PARCOURS-J1.md](docs/PARCOURS-J1.md)
- runbook CI/CD Vercel: [docs/runbooks/cicd-workflow.md](docs/runbooks/cicd-workflow.md)
- cycle de vie des variables: [docs/runbooks/env-vars-lifecycle.md](docs/runbooks/env-vars-lifecycle.md)
- gouvernance GitHub et configuration Vercel: [docs/runbooks/repository-governance-setup.md](docs/runbooks/repository-governance-setup.md)
- procedure ecran par ecran GitHub et Vercel: [docs/runbooks/remote-setup-clickpath.md](docs/runbooks/remote-setup-clickpath.md)
- contrat futur de liste des verifications: [docs/reference/KYC-SESSIONS-LIST-CONTRACT.md](docs/reference/KYC-SESSIONS-LIST-CONTRACT.md)
- UX page de connexion: [docs/reference/AUTH-UX.md](docs/reference/AUTH-UX.md)
- UX metadata de session: [docs/reference/SESSION-CONTEXT-UX.md](docs/reference/SESSION-CONTEXT-UX.md)
- guide d'integration React: [docs/reference/KYCLINK-SDK-INTEGRATION.md](docs/reference/KYCLINK-SDK-INTEGRATION.md)
- canon UI/UX local: [docs/reference/UI-ESTHETIC-CANON.md](docs/reference/UI-ESTHETIC-CANON.md)
- consignes locales agent: [AGENTS.md](AGENTS.md)

## Decision J1

Le J1 vise un flux minimal:

1. login utilisateur via Cognito
2. verification serveur du JWT
3. resolution du tenant demo a partir des claims Cognito
4. derivation de `externalId` a partir de la reference client
5. selection de la bonne ck_demo_* cote serveur
6. creation de session KYC via partner-node
7. affichage de @kycly/link

## Etat actuel du scaffold

Le socle applicatif minimal est maintenant present dans ce dossier:

- app Next.js App Router
- login Cognito Hosted UI avec callback serveur et cookie HTTP-only
- routes `GET /auth/login`, `GET /auth/callback`, `POST /auth/logout`, `GET /api/me`, `POST /api/kyc/session`, `GET /api/kyc/sessions`
- pages `LOGIN`, `WELCOME`, `ACCESS_DENIED`, `VERIFY`, `SESSIONS`
- formulaire `SESSION_CONTEXT` conforme aux decisions J1
- proxy serveur de creation et de lecture des sessions KYC avec resolution `DEMO_ACCOUNT_KEY_MAP`

## Demarrage local

1. copier `.env.example` vers `.env.local`
2. renseigner les variables Cognito et la map `DEMO_ACCOUNT_KEY_MAP`
3. lancer `pnpm install`
4. lancer `pnpm dev`

`pnpm install` reconfigure aussi les hooks Git locaux via `pnpm prepare`. Si besoin, relancer `pnpm prepare` pour reappliquer `.githooks/`.

Commandes utiles:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm docs:check`
- `pnpm guard:sandbox-only`
- `pnpm prepare`

## Variables minimales

Variables publiques:

- `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_DOMAIN`
- `NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN`
- `NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`

Variables serveur:

- `APP_SESSION_SECRET`
- `COGNITO_CLIENT_SECRET` si le client Cognito en a besoin
- `KYCLY_API_BASE_URL` vers le runtime sandbox de `partner-node`
- `DEMO_ACCOUNT_KEY_MAP`

## Note d'implementation

Le scaffold consomme maintenant `@kycly/link` depuis GitHub Packages et utilise `@kycly/link/react` pour embarquer le parcours KycLink. Les etats `COMPLETE` et `FAILURE` sont geres cote UI sans changer le contrat backend deja pose.

## Hors scope J1

- base de donnees dediee
- synchronisation runtime avec partner-node
- acces direct a la base partner-node
- multi-deploiement par tenant
- backoffice ou analytics avances

## Cadrage separation sandbox

- `whitelabel-vercel` ne doit utiliser que des `ck_demo_*`, jamais des `ck_live_*`
- la liste canonique future des verifications d'un utilisateur doit venir de `partner-node` sandbox, scopee par `demo_account_id`
- si une page `mes verifications` est ajoutee plus tard, elle doit passer par un proxy serveur de type `GET /api/kyc/sessions` vers `partner-node /kyclink/sessions`, sans persistance locale dediee par defaut
