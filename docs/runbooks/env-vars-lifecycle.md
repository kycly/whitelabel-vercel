# Cycle de vie des variables d'environnement — whitelabel-vercel

Runbook de reference pour les variables build-time et runtime de `whitelabel-vercel`.

Ce document fige la facon de gerer les variables dans le projet pour la suite retenue:

- application Next.js deployee sur Vercel
- quality gate GitHub Actions
- environnements `Preview` et `Production` sur Vercel
- portee metier `sandbox-only` au J1

---

## Regle generale

La source de verite runtime de l'application est Vercel.

Repartition retenue:

- local: `.env.local`
- CI GitHub Actions: variables non sensibles de validation + secrets de lecture GitHub Packages si necessaire
- Vercel Preview: variables de runtime preview
- Vercel Production: variables de runtime production

Regle structurante:

- les variables Vercel `Preview` et `Production` decrivent deux stades de deploiement de `whitelabel-vercel`
- elles ne changent pas la cible metier de l'application
- les deux environnements restent branches sur `partner-node sandbox`

---

## Fichier local de reference

Le template local de depart est:

- `.env.example`

Usage local retenu:

1. copier `.env.example` vers `.env.local`
2. remplacer les placeholders par des valeurs reelles de sandbox
3. ne jamais commiter `.env.local`

`whitelabel-vercel` ne fournit pas de matrice complexe de templates. Le contrat ops du projet repose sur:

- un template simple `.env.example`
- une separation propre entre `Preview` et `Production` dans Vercel

---

## Environnements supportes

### 1. Local

Objectif:

- developpement local
- validation manuelle des ecrans et callbacks Cognito

Source des variables:

- `.env.local`

### 2. CI GitHub Actions

Objectif:

- executer `pnpm test`
- executer `pnpm typecheck`
- executer `pnpm lint`
- executer `pnpm build`

Source des variables:

- `env:` dans le workflow CI pour les valeurs non sensibles de validation
- `secrets.GH_PACKAGES_TOKEN` pour installer les packages prives depuis GitHub Packages

### 3. Vercel Preview

Objectif:

- deploiement preview automatique sur PR et branches non productives

Source des variables:

- Vercel Environment `Preview`

### 4. Vercel Production

Objectif:

- deploiement du domaine canonique de production de `whitelabel-vercel`

Source des variables:

- Vercel Environment `Production`

---

## Variables du projet

### Variables publiques

Ces variables peuvent etre lues par le code client Next.js.

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_APP_ENV` | etiquette d'environnement de l'app |
| `NEXT_PUBLIC_AWS_REGION` | region AWS exposee au frontend si necessaire |
| `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID` | app client Cognito dedie a `whitelabel-vercel` |
| `NEXT_PUBLIC_COGNITO_DOMAIN` | domaine Hosted UI Cognito |
| `NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN` | URL de callback login |
| `NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT` | URL de retour logout |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | user pool Cognito |

### Variables serveur

Ces variables ne doivent jamais etre exposees au navigateur.

| Variable | Description |
|---|---|
| `APP_SESSION_SECRET` | secret de signature du cookie de session applicative |
| `COGNITO_CLIENT_SECRET` | secret du client Cognito si le client l'exige |
| `KYCLY_API_BASE_URL` | URL du runtime `partner-node` appele cote serveur |
| `DEMO_ACCOUNT_KEY_MAP` | map `demo_account_id -> ck_demo_*` |
| `DEFAULT_KYCLINK_THEME` | theme par defaut KycLink |

---

## Regles par variable

### `NEXT_PUBLIC_APP_ENV`

Valeurs retenues:

- local: `local`
- preview: `preview`
- production: `production`

Role:

- etiquetage applicatif et debug leger

### Variables Cognito publiques

Variables concernees:

- `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_DOMAIN`
- `NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN`
- `NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`

Regles retenues:

- meme user pool Cognito que `partner-node`
- app client dedie a `whitelabel-vercel`
- callbacks distincts et coherents entre `Preview` et `Production`

### `APP_SESSION_SECRET`

Role:

- signer le cookie HTTP-only de session applicative

Regles retenues:

- valeur longue, aleatoire, dedicatee a `whitelabel-vercel`
- valeur differente entre `Preview` et `Production`
- ne jamais exposer cette valeur dans le client

### `COGNITO_CLIENT_SECRET`

Role:

- permettre l'echange de code OAuth quand l'app client Cognito a un secret

Regles retenues:

- vide si l'app client n'en demande pas
- definie uniquement cote serveur si necessaire

### `KYCLY_API_BASE_URL`

Role:

- URL du backend KYC appele par les route handlers Next.js

Regle J1 retenue:

- `Preview` -> runtime `partner-node sandbox`
- `Production` -> runtime `partner-node sandbox`

Cette variable ne doit pas pointer vers `partner-node production` tant qu'une decision explicite ne modifie pas le blueprint du projet.

### `DEMO_ACCOUNT_KEY_MAP`

Role:

- mapper un `demo_account_id` Cognito vers une cle `ck_demo_*`

Format retenu:

```json
{
  "demo_acme": "ck_demo_xxx"
}
```

Regles retenues:

- JSON objet strictement cote serveur
- seulement des `ck_demo_*`
- jamais de `ck_live_*`
- absence de mapping -> erreur serveur explicite
- pas de fallback silencieux

### `DEFAULT_KYCLINK_THEME`

Role:

- definir le theme KycLink par defaut

Valeur par defaut retenue:

- `kycly-light`

---

## Separation Preview / Production

La separation retenue porte sur le runtime de l'application, pas sur la cible metier.

### Ce qui change entre `Preview` et `Production`

- le domaine public de l'application
- les URLs Cognito de sign-in et sign-out
- le secret de session applicative
- eventuellement la map des comptes demo si une segregation est voulue

### Ce qui ne change pas au J1

- la cible `partner-node sandbox`
- l'usage exclusif de `ck_demo_*`
- l'absence de toute `ck_live_*`

---

## Variables minimales par environnement

### Local

- `NEXT_PUBLIC_APP_ENV=local`
- `NEXT_PUBLIC_AWS_REGION`
- `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_DOMAIN`
- `NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN=http://localhost:3000/auth/callback`
- `NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT=http://localhost:3000/login`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `APP_SESSION_SECRET`
- `COGNITO_CLIENT_SECRET` si necessaire
- `KYCLY_API_BASE_URL`
- `DEMO_ACCOUNT_KEY_MAP`
- `DEFAULT_KYCLINK_THEME`

### Vercel Preview

- `NEXT_PUBLIC_APP_ENV=preview`
- `NEXT_PUBLIC_AWS_REGION`
- `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_DOMAIN`
- `NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN` -> URL preview active `/auth/callback`
- `NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT` -> URL preview active `/login`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `APP_SESSION_SECRET`
- `COGNITO_CLIENT_SECRET` si necessaire
- `KYCLY_API_BASE_URL` -> sandbox
- `DEMO_ACCOUNT_KEY_MAP` -> `ck_demo_*` uniquement
- `DEFAULT_KYCLINK_THEME`

### Vercel Production

- `NEXT_PUBLIC_APP_ENV=production`
- `NEXT_PUBLIC_AWS_REGION`
- `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_DOMAIN`
- `NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN` -> domaine canonique `/auth/callback`
- `NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT` -> domaine canonique `/login`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `APP_SESSION_SECRET`
- `COGNITO_CLIENT_SECRET` si necessaire
- `KYCLY_API_BASE_URL` -> sandbox
- `DEMO_ACCOUNT_KEY_MAP` -> `ck_demo_*` uniquement
- `DEFAULT_KYCLINK_THEME`

---

## Variables de CI retenues

Le workflow CI GitHub doit injecter des valeurs non sensibles minimales pour garantir un build reproductible.

Variables minimales retenues dans la CI:

- `NEXT_PUBLIC_APP_ENV=ci`
- placeholders Cognito publics de validation
- `APP_SESSION_SECRET` de validation
- `COGNITO_CLIENT_SECRET` de validation
- `KYCLY_API_BASE_URL` de validation
- `DEMO_ACCOUNT_KEY_MAP` de validation avec une `ck_demo_*` factice

Secrets CI retenus:

- `GH_PACKAGES_TOKEN` pour installer `@kycly/link` via GitHub Packages

---

## Rotation

### `APP_SESSION_SECRET`

Procedure retenue:

1. generer une nouvelle valeur aleatoire
2. mettre a jour l'environnement Vercel cible
3. redeployer l'application
4. verifier la connexion et le callback `/auth/callback`

Effet attendu:

- les sessions applicatives precedentes deviennent invalides

### `COGNITO_CLIENT_SECRET`

Procedure retenue:

1. mettre a jour le secret cote Cognito
2. mettre a jour la variable Vercel correspondante
3. redeployer
4. verifier le login Hosted UI et le callback

### `DEMO_ACCOUNT_KEY_MAP`

Procedure retenue:

1. mettre a jour les cles `ck_demo_*` dans la source secrete retenue
2. mettre a jour `DEMO_ACCOUNT_KEY_MAP` dans Vercel
3. redeployer
4. verifier `POST /api/kyc/session`
5. verifier `GET /api/kyc/sessions`

### `KYCLY_API_BASE_URL`

Procedure retenue:

1. mettre a jour la variable dans Vercel
2. redeployer
3. verifier creation et lecture de session

---

## Verification apres changement de variables

Apres tout changement sur les variables structurantes, verifier:

1. `LOGIN`
2. `WELCOME`
3. `POST /api/kyc/session`
4. `GET /api/kyc/session/:sessionId/result`
5. `GET /api/kyc/sessions`
6. logout Cognito

---

## Checklist de mise en place

- [ ] renseigner `Preview` dans Vercel
- [ ] renseigner `Production` dans Vercel
- [ ] verifier les callbacks Cognito preview
- [ ] verifier les callbacks Cognito production
- [ ] charger `GH_PACKAGES_TOKEN` dans GitHub Actions
- [ ] verifier que `DEMO_ACCOUNT_KEY_MAP` ne contient que des `ck_demo_*`
- [ ] verifier que `KYCLY_API_BASE_URL` cible `partner-node sandbox`

---

## Decision finale retenue

La gestion des variables de `whitelabel-vercel` repose donc sur:

- un template local unique `.env.example`
- des variables runtime gouvernees par Vercel
- une separation `Preview` / `Production` au niveau applicatif
- une cible metier unique `partner-node sandbox`
- des cles `ck_demo_*` uniquement
- une CI GitHub avec placeholders non sensibles et secret GitHub Packages dedie

Ce document est la reference ops a suivre pour la suite.