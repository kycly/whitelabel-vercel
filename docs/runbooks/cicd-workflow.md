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
5. `pnpm test`
6. `pnpm typecheck`
7. `pnpm lint`
8. `pnpm build`

Ordre de severite retenu:

- les tests executables passent avant les controles purement statiques
- le build reste obligatoire pour verifier le runtime Next/Vercel

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
- `NEXT_PUBLIC_COGNITO_DOMAIN`
- `NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN`
- `NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`

### Variables serveur minimales

- `APP_SESSION_SECRET`
- `COGNITO_CLIENT_SECRET` si le client Cognito l'exige
- `KYCLY_API_BASE_URL`
- `DEMO_ACCOUNT_KEY_MAP`
- `DEFAULT_KYCLINK_THEME` si override necessaire

### Politique retenue

- `APP_SESSION_SECRET` doit etre distinct entre `Preview` et `Production`
- `DEMO_ACCOUNT_KEY_MAP` reste strictement cote serveur
- `KYCLY_API_BASE_URL` pointe vers `partner-node sandbox` pour `Preview` et `Production`
- `DEMO_ACCOUNT_KEY_MAP` ne contient que des `ck_demo_*`

### Invariant J1

Pour `Preview` comme pour `Production`:

- `KYCLY_API_BASE_URL` -> runtime sandbox de `partner-node`
- `DEMO_ACCOUNT_KEY_MAP` -> seulement des cles `ck_demo_*`

---

## Cognito et URLs de callback

La configuration Cognito doit etre compatible avec les deux environnements Vercel.

### Sign-in callback

Les URLs de callback autorisees doivent couvrir:

- l'URL preview active de l'application
- le domaine canonique de production

### Sign-out callback

Les URLs de logout autorisees doivent couvrir:

- l'URL preview active de l'application
- le domaine canonique de production

### Regle retenue

Les variables suivantes doivent etre definies de facon coherente par environnement:

- `NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN`
- `NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT`

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

- valider rapidement l'UX, le login, les callbacks Cognito et les integrations de session dans un environnement proche du runtime final

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
2. redirection Cognito
3. callback `/auth/callback`
4. ecran `WELCOME`
5. creation de session `/api/kyc/session`
6. lecture resultat `/api/kyc/session/:sessionId/result`
7. liste `/api/kyc/sessions`

---

## Documentation a maintenir avec ce workflow

La documentation doit rester alignee avec la realite operatoire.

Quand la chaine CI/CD evolue, mettre a jour en meme temps:

- ce runbook
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
- [ ] verifier les callbacks Cognito preview et production
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