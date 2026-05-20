# Runbook — CI/CD Vercel

Reference complete du deploiement et de la CI/CD retenus pour `whitelabel-vercel`.

Ce document fige ce qui doit etre mis en place pour la suite. Il ne compare pas plusieurs options et ne documente pas les approches ecartees. Il sert de cible operatoire.

---

## Objectif

Donner a `whitelabel-vercel` une chaine CI/CD de niveau production applicative, alignee en rigueur sur `partner-node`, mais adaptee a son runtime reel:

- application Next.js deployee sur Vercel
- quality gate porte par GitHub Actions
- deploiements Vercel nativement relies au repository GitHub
- separation explicite entre `preview` et `production`
- portee metier toujours `sandbox-only` au J1

---

## Decision retenue

La methode de deploiement retenue est la suivante:

- moteur de deploiement: Vercel Git Integration native
- quality gate: GitHub Actions
- preview: deploiement automatique sur pull request et branches non productives
- production: deploiement automatique depuis la branche `production`
- promotion metier: aucune bascule automatique vers `partner-node production`

Implication importante:

- `preview` et `production` designent les stades de deploiement de l'app `whitelabel-vercel`
- ces deux stades restent branches sur `partner-node sandbox`
- aucune `ck_live_*` n'est autorisee dans cette application tant qu'une decision explicite ne change pas le blueprint

---

## Architecture cible

### 1. GitHub

GitHub porte:

- la revue de code
- le workflow CI obligatoire
- les GitHub Environments de gouvernance
- les protections de branches

Environnements GitHub retenus:

- `vercel-preview`
- `vercel-production`

### 2. Vercel

Vercel porte:

- le build Next.js final
- le deploiement preview
- le deploiement production
- les variables d'environnement runtime de l'application

Environnements Vercel retenus:

- `Preview`
- `Production`

### 3. Separation des responsabilites

GitHub Actions ne deploie pas l'application en premier ressort. GitHub Actions valide la qualite et bloque les merges non conformes. Vercel reste responsable du deploiement effectif de l'application.

---

## Branches et promotion

Strategie de branches retenue:

- `main`: branche d'integration continue
- `production`: branche de deploiement production

Politique de promotion retenue:

1. une pull request est ouverte vers `main`
2. la CI GitHub s'execute
3. Vercel genere un deploiement `Preview`
4. une fois la validation terminee, le changement est merge sur `main`
5. quand un lot est juge deployable, il est promu sur `production`
6. Vercel deploie automatiquement l'environnement `Production`

Conclusion operatoire:

- `main` sert a integrer et verifier
- `production` sert a publier
- le deploiement production n'est jamais attache directement a une simple PR mergee sur `main`

---

## Workflow CI retenu

Le workflow GitHub Actions de reference doit jouer le role de quality gate obligatoire.

Nom recommande:

- `.github/workflows/ci.yml`

Declencheurs retenus:

- `pull_request` sur `main` et `production`
- `push` sur `main` et `production`

Concurrence retenue:

- annulation des runs obsoletes sur une meme PR ou une meme branche

Permissions retenues:

- `contents: read`
- `packages: read` si des packages prives GitHub Packages sont resolus pendant l'installation

Runtime retenu:

- Node.js 22
- pnpm 10.x

Ordre des etapes retenu:

1. checkout
2. setup pnpm
3. setup Node.js
4. `pnpm install --frozen-lockfile`
5. `pnpm docs:check`
6. `pnpm guard:sandbox-only`
7. `pnpm test`
8. `pnpm typecheck`
9. `pnpm lint`
10. `pnpm build`
11. `pnpm exec playwright install --with-deps chromium webkit`
12. `PLAYWRIGHT_SKIP_BUILD=1 pnpm test:e2e`

Ordre de severite retenu:

- la coherence documentaire canonique doit etre validee avant le reste du gate
- le garde-fou sandbox-only doit bloquer toute introduction de `ck_live_*`
- les tests executables passent avant les controles purement statiques
- le build reste obligatoire pour verifier le runtime Next/Vercel
- les smokes navigateur Playwright doivent ensuite verifier le tunnel critique, le repli retour vers logout et le tunnel protege mobile sur le build produit, sur les projets Playwright actives dans `playwright.config.ts`

Note locale:

- `PLAYWRIGHT_SKIP_BUILD=1 pnpm test:e2e` est reserve a la CI apres `pnpm build`
- apres une modification UI locale, relancer au moins une fois `pnpm test:e2e` sans `PLAYWRIGHT_SKIP_BUILD=1` pour eviter un `.next` stale

## Hooks locaux retenus

Le repository doit porter un gate local aligne sur la CI.

Implementation retenue:

- hooks Git versionnes dans `.githooks/`
- activation locale via `git config core.hooksPath .githooks`
- installation automatique via `pnpm prepare`

Pre-commit retenu:

- `lint-staged`
- `pnpm test`

Pre-push retenu:

- `pnpm docs:check`
- `pnpm guard:sandbox-only`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

Conclusion operatoire:

- `pnpm install` doit reconfigurer les hooks localement
- un push est bloque si la doc canonique n'est pas alignee ou si un marqueur `ck_live_*` apparait dans les surfaces applicatives
- les changements sur le shell mobile-first, l'installabilite PWA ou l'ergonomie du tunnel KYC critique doivent aussi mettre a jour [../reference/PWA-MOBILE-FIRST-REFACTOR.md](../reference/PWA-MOBILE-FIRST-REFACTOR.md)

Artefacts recommandés:

- pas d'artefact deployable mandatory au J1
- en option: upload d'un resume de build ou d'un rapport de tests si besoin ulterieur

---

## Regles de merge

Les regles suivantes doivent etre actives:

- protection de `main`
- protection de `production`
- status check GitHub Actions obligatoire avant merge
- interdiction du push direct sur `production`
- merge vers `production` reserve a une promotion intentionnelle

Regle d'exploitation retenue:

- pas de deploy production sans PR ou promotion explicite vers `production`

---

## Configuration Vercel retenue

### Projet

Le projet Vercel doit etre dedie a `whitelabel-vercel`.

### Liaison Git

Le projet Vercel doit etre connecte directement au repository GitHub qui contient `whitelabel-vercel`.

### Root directory

Le root directory Vercel doit pointer sur:

- `whitelabel-vercel/`

### Build

Commandes retenues:

- install: `pnpm install --frozen-lockfile`
- build: `pnpm build`
- output: detection standard Next.js par Vercel

### Branche de production

La branche de production Vercel retenue est:

- `production`

### Preview

Les previews Vercel doivent etre laissees actives sur:

- pull requests
- branches hors `production`

---

## Variables et secrets retenus

Les variables doivent etre separees par environnement Vercel.

### Variables publiques minimales

- `NEXT_PUBLIC_APP_ENV`
- `NEXT_PUBLIC_AWS_REGION`
- `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`

### Variables serveur minimales

- `APP_SESSION_SECRET`
- `APP_CANONICAL_ORIGIN` si vous voulez figer `parentOrigin` cote serveur
- `NODE_AUTH_TOKEN` pour le build Vercel si `@kycly/link` est installe depuis GitHub Packages
- `KYCLY_API_BASE_URL`
- `KYCLY_SESSION_BASE_URL`
- `KYCLY_ME_BASE_URL`
- `DEFAULT_KYCLINK_THEME` si override necessaire

### Politique retenue

- `APP_SESSION_SECRET` doit etre distinct entre `Preview` et `Production`
- `APP_CANONICAL_ORIGIN` doit pointer vers le host public qui doit etre autorise a embarquer KycLink; si vide, l'app derive l'origine depuis les headers forwardes / `host`
- `NODE_AUTH_TOKEN` doit etre present dans Vercel `Preview` et `Production` si le build installe `@kycly/link`
- `KYCLY_API_BASE_URL` pointe vers `partner-node sandbox` pour `POST /kyclink/create` et `GET /kyclink/:sessionId/result` en `Preview` et `Production`
- `KYCLY_SESSION_BASE_URL` pointe vers le host exposant `GET /kyclink/sessions` en `Preview` et `Production`, ou reste vide pour replier sur `KYCLY_API_BASE_URL`
- `KYCLY_ME_BASE_URL` pointe vers l'hote exposant `/demo/me` en `Preview` et `Production`
- l'id token Cognito reste strictement cote serveur dans la session HTTP-only

### Invariant J1

Pour `Preview` comme pour `Production`:

- `KYCLY_API_BASE_URL` -> runtime sandbox de `partner-node` pour `/kyclink/*`
- `APP_CANONICAL_ORIGIN` -> host public autorise pour l'iframe KycLink, ou vide pour derivation proxy / host
- `KYCLY_SESSION_BASE_URL` -> host exposant `GET /kyclink/sessions`, ou vide pour reutiliser `KYCLY_API_BASE_URL`
- `KYCLY_ME_BASE_URL` -> host exposant `/demo/me`
- aucune `ck_live_*`

---

## Contrat Cognito retenu

Le flux J1 repose sur un login Cognito direct dans l'application.

La configuration Cognito a garder coherente entre CI, Vercel et le user pool est donc:

- `NEXT_PUBLIC_AWS_REGION`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`

La CI doit verifier que ces trois valeurs suffisent a restaurer le login direct et la creation de session applicative.

---

## GitHub Environments retenus

Les environnements GitHub ne remplacent pas Vercel. Ils servent a gouverner la chaine CI/CD.

### `vercel-preview`

Usage retenu:

- lisibilite des runs preview
- eventuels secrets CI futurs
- eventuelles protections de validation preview

### `vercel-production`

Usage retenu:

- gouvernance des promotions production
- eventuelle approbation manuelle ulterieure
- eventuels secrets CI lies a la branche `production`

---

## Politique de qualite retenue

Le minimum obligatoire pour toute PR est:

- tests verts
- typecheck vert
- lint vert
- build vert

La CI doit etre consideree comme bloquante. Un changement non valide ne doit pas etre merge.

---

## Politique de deploiement retenue

### Preview

Le deploiement preview est automatique.

Objectif:

- valider rapidement l'UX, le login Cognito direct et les integrations de session dans un environnement proche du runtime final

### Production

Le deploiement production est automatique apres mise a jour de la branche `production`.

Objectif:

- garder un mode de publication intentionnel
- separer clairement integration continue et publication

---

## Sequence operatoire retenue

### Pour une evolution standard

1. ouvrir une PR vers `main`
2. laisser la CI GitHub tourner
3. verifier la preview Vercel
4. merger dans `main`
5. lorsque le lot est pret, promouvoir vers `production`
6. laisser Vercel deployer `Production`

### Pour une verification de runtime

Verifier apres deploy:

1. page `LOGIN`
2. login Cognito direct
3. creation de session applicative via `POST /api/auth/session`
4. ecran `WELCOME`
5. creation de session `/api/kyc/session`
6. lecture resultat `/api/kyc/session/:sessionId/result`
7. liste `/api/kyc/sessions`

---

## Documentation a maintenir avec ce workflow

La documentation doit rester alignee avec la realite operatoire.

Quand la chaine CI/CD evolue, mettre a jour en meme temps:

- ce runbook
- [env-vars-lifecycle.md](env-vars-lifecycle.md)
- [repository-governance-setup.md](repository-governance-setup.md)
- [remote-setup-clickpath.md](remote-setup-clickpath.md)
- `README.md`
- `AGENTS.md`
- toute doc de variables d'environnement ou de blueprint impactee

---

## Checklist de mise en place

- [ ] creer le projet Vercel dedie
- [ ] connecter le repository GitHub
- [ ] definir `whitelabel-vercel/` comme root directory
- [ ] configurer la branche de production Vercel sur `production`
- [ ] configurer les variables `Preview`
- [ ] configurer les variables `Production`
- [ ] verifier la coherence region / user pool / app client id
- [ ] creer les GitHub Environments `vercel-preview` et `vercel-production`
- [ ] ajouter `.github/workflows/ci.yml`
- [ ] rendre la CI obligatoire sur `main` et `production`
- [ ] proteger la branche `production`

---

## Decision finale retenue

Le modele cible de `whitelabel-vercel` est donc:

- deploiement applicatif natif par Vercel
- quality gate obligatoire par GitHub Actions
- branche `main` pour integrer
- branche `production` pour publier
- environnements Vercel `Preview` et `Production`
- environnements GitHub `vercel-preview` et `vercel-production`
- cible metier unique `partner-node sandbox`
- aucune `ck_live_*` dans l'application au J1

Cette cible est la reference a suivre pour la suite.