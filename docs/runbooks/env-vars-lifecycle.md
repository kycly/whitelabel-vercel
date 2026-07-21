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

Distinction importante:

- `GH_PACKAGES_TOKEN` est un secret GitHub Actions pour la CI
- `NODE_AUTH_TOKEN` est un secret Vercel requis au build si `.npmrc` installe `@kycly/link` depuis GitHub Packages

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
- validation manuelle des ecrans et du login Cognito direct

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
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | user pool Cognito |

### Variables serveur

Ces variables ne doivent jamais etre exposees au navigateur.

| Variable | Description |
|---|---|
| `APP_SESSION_SECRET` | secret de signature du cookie de session applicative |
| `APP_CANONICAL_ORIGIN` | origin canonique optionnelle transmise comme `parentOrigin` a `partner-node /kyclink/create`; si vide, l'app derive l'origin cote serveur depuis les headers forwardes puis `host` |
| `NODE_AUTH_TOKEN` | secret de build pour authentifier pnpm contre GitHub Packages via `.npmrc` |
| `KYCLY_BASE_URL` | URL unique du runtime `partner-node`, appelee cote serveur avec l'endpoint voulu : `/demo/me`, `/kyclink/create`, `/kyclink/{id}`, `/kyclink/{id}/result`, `/kyclink/sessions` |
| `DEFAULT_KYCLINK_THEME` | theme par defaut KycLink |
| `CF_ACCESS_CLIENT_ID` | Client ID du service token Cloudflare Access (appels serveur vers partner-node) |
| `CF_ACCESS_CLIENT_SECRET` | Client Secret du service token Cloudflare Access |

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
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `NEXT_PUBLIC_AWS_REGION`

Regles retenues:

- meme user pool Cognito que `partner-node`
- app client dedie a `whitelabel-vercel`
- aucune URL de callback ou de logout a maintenir pour l'authentification

### `APP_SESSION_SECRET`

Role:

- signer le cookie HTTP-only de session applicative

Regles retenues:

- valeur longue, aleatoire, dedicatee a `whitelabel-vercel`
- valeur differente entre `Preview` et `Production`
- une valeur placeholder comme `replace-with-a-long-random-secret` ne doit jamais etre reutilisee hors local
- hors environnement `local`, l'application doit echouer au demarrage si `APP_SESSION_SECRET` est absent ou reste sur un placeholder
- ne jamais exposer cette valeur dans le client

### `APP_CANONICAL_ORIGIN`

Role:

- figer l'origine parent envoyee a `partner-node /kyclink/create`

Regles retenues:

- valeur optionnelle mais recommandee des qu'un host public stable existe
- doit etre une origin bare (`https://app.example.com`), sans path, query string ni hash
- si elle est vide, l'application derive `parentOrigin` cote serveur depuis `x-forwarded-host` / `x-forwarded-proto`, puis `host`
- ne jamais utiliser le header navigateur `Origin` comme source de verite
- en cas de previews ou d'alias multiples, definir explicitement cette variable elimine les divergences Safari / Android / webview

### `NODE_AUTH_TOKEN`

Role:

- permettre a `pnpm install` d'acceder a `@kycly/link` sur GitHub Packages via `.npmrc`

Regles retenues:

- requis dans Vercel `Preview` et `Production` si le build installe `@kycly/link`
- ne pas confondre avec `GH_PACKAGES_TOKEN`, qui sert a la CI GitHub Actions
- ne jamais exposer cette valeur dans le client

### `KYCLY_BASE_URL`

Role:

- URL du backend KYC appele par les route handlers Next.js pour `POST /kyclink/create` et `GET /kyclink/:sessionId/result`

Regle J1 retenue:

- `Preview` -> runtime `partner-node sandbox`
- `Production` -> runtime `partner-node sandbox`

Cette variable ne doit pas pointer vers `partner-node production` tant qu'une decision explicite ne modifie pas le blueprint du projet.

**Contournement Cloudflare (interim, cf. [ADR-005](../architecture/decisions/005-partner-node-direct-ip-cloudflare-bypass.md))** :
Cloudflare (qui protege partner-node) **bloque les requetes serveur venant de Vercel/AWS**, y compris le
premier appel post-login `GET /demo/me` — ce qui provoquait un `ACCESS_DENIED` juste apres l'auth. Pour
debloquer, `KYCLY_BASE_URL` pointe actuellement sur l'**IP publique directe de partner-node**, en
contournant Cloudflare. Consequences a surveiller : perte des protections Cloudflare (WAF/DDoS/bot),
exposition de l'IP d'origine, verification TLS `https://<ip>` a controler, mise a jour manuelle si l'IP
change. **Cible** : revenir au hostname une fois la policy Cloudflare Access/WAF correctement ouverte pour
Vercel sur tous les chemins (`/demo/me`, `/kyclink/*`).

### `DEFAULT_KYCLINK_THEME`

Role:

- definir le theme KycLink par defaut

Valeur par defaut retenue:

- `kycly-light`

### `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`

Role:

- `partner-node` est protege par Cloudflare : les requetes serveur-a-serveur venant de Vercel/AWS
  sont bloquees sauf si elles presentent un **service token Cloudflare Access**. whitelabel envoie
  donc, sur ses appels serveur vers partner-node (`/demo/me`, `/kyclink/*`), les en-tetes
  `CF-Access-Client-Id` / `CF-Access-Client-Secret`.

Regles retenues:

- couple genere cote Cloudflare Zero Trust (Access > Service Auth), scope aux endpoints partner-node necessaires
- present dans Vercel `Preview` et `Production` si partner-node est derriere Cloudflare Access
- **optionnels** : si l'un des deux manque, aucun en-tete n'est ajoute (dev local / partner-node non protege)
- ne jamais exposer ces valeurs au navigateur (variables serveur uniquement)
- implementation : `src/config/partner-access.ts` (`buildPartnerAccessHeaders`), injecte dans
  `src/server/kyclink.ts` et `src/auth/cognito.ts`
- **etat actuel** : le service token n'a pas suffi a debloquer les appels ; on utilise le contournement
  IP directe (cf. [ADR-005](../architecture/decisions/005-partner-node-direct-ip-cloudflare-bypass.md)).
  Tant que `KYCLY_BASE_URL` pointe sur l'IP directe, ces variables sont **sans effet** (aucun Cloudflare
  dans le chemin) mais restent en place pour le retour au hostname.

---

## Separation Preview / Production

La separation retenue porte sur le runtime de l'application, pas sur la cible metier.

### Ce qui change entre `Preview` et `Production`

- le domaine public de l'application
- le secret de session applicative
- eventuellement les hosts `KYCLY_*` si l'exposition reseau evolue

### Ce qui ne change pas au J1

- la cible `partner-node sandbox`
- l'usage d'un id token Cognito cote serveur pour `/kyclink/*`
- l'absence de toute `ck_live_*`

---

## Variables minimales par environnement

### Local

- `NEXT_PUBLIC_APP_ENV=local`
- `NEXT_PUBLIC_AWS_REGION`
- `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `APP_SESSION_SECRET`
- `NODE_AUTH_TOKEN` si l'installation locale doit resoudre `@kycly/link`
- `KYCLY_BASE_URL`
- `DEFAULT_KYCLINK_THEME`

### Vercel Preview

- `NEXT_PUBLIC_APP_ENV=preview`
- `NEXT_PUBLIC_AWS_REGION`
- `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `APP_SESSION_SECRET`
- `NODE_AUTH_TOKEN`
- `KYCLY_BASE_URL` -> sandbox
- `DEFAULT_KYCLINK_THEME`

### Vercel Production

- `NEXT_PUBLIC_APP_ENV=production`
- `NEXT_PUBLIC_AWS_REGION`
- `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `APP_SESSION_SECRET`
- `NODE_AUTH_TOKEN`
- `KYCLY_BASE_URL` -> sandbox
- `DEFAULT_KYCLINK_THEME`

---

## Variables de CI retenues

Le workflow CI GitHub doit injecter des valeurs non sensibles minimales pour garantir un build reproductible.

Variables minimales retenues dans la CI:

- `NEXT_PUBLIC_APP_ENV=ci`
- `NEXT_PUBLIC_AWS_REGION`
- `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `APP_SESSION_SECRET` de validation
- `KYCLY_BASE_URL` de validation

Secrets CI retenus:

- `GH_PACKAGES_TOKEN` pour installer `@kycly/link` via GitHub Packages

---

## Rotation

### `APP_SESSION_SECRET`

Procedure retenue:

1. generer une nouvelle valeur aleatoire
2. mettre a jour l'environnement Vercel cible
3. redeployer l'application
4. verifier la connexion et la creation de session applicative

Effet attendu:

- les sessions applicatives precedentes deviennent invalides

### `KYCLY_BASE_URL`

Procedure retenue:

1. mettre a jour la variable dans Vercel
2. redeployer
3. verifier creation et lecture de session

## Verification apres changement de variables

Apres tout changement sur les variables structurantes, verifier:

1. `LOGIN`
2. `WELCOME`
3. `POST /api/kyc/session`
4. `GET /api/kyc/session/:sessionId/result`
5. `GET /api/kyc/sessions`
6. logout applicatif

---

## Checklist de mise en place

- [ ] renseigner `Preview` dans Vercel
- [ ] renseigner `Production` dans Vercel
- [ ] verifier la coherence region / user pool / app client id
- [ ] charger `GH_PACKAGES_TOKEN` dans GitHub Actions
- [ ] verifier que `KYCLY_BASE_URL` cible `partner-node sandbox`

---

## Decision finale retenue

La gestion des variables de `whitelabel-vercel` repose donc sur:

- un template local unique `.env.example`
- des variables runtime gouvernees par Vercel
- une separation `Preview` / `Production` au niveau applicatif
- une cible metier unique `partner-node sandbox`
- un id token Cognito conserve cote serveur pour `/kyclink/*`
- une CI GitHub avec placeholders non sensibles et secret GitHub Packages dedie

Ce document est la reference ops a suivre pour la suite.