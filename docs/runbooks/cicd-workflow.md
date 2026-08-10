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

Ordre des etapes retenu, tel qu'il est reellement code dans `ci.yml`:

1. garde-fou source de promotion (`pull_request` vers `production` refuse toute branche source autre que `main`)
2. checkout
3. setup pnpm
4. setup Node.js
5. `pnpm install --frozen-lockfile`
6. `node scripts/security/audit-pnpm-tree.mjs` — audit de securite des dependances
7. `pnpm docs:check`
8. `pnpm docs:truth`
9. `pnpm docs:structure`
10. `pnpm docs:codegen:check`
11. `pnpm guard:sandbox-only`
12. `pnpm test`
13. `pnpm typecheck`
14. `pnpm lint`
15. `pnpm build`
16. `pnpm exec playwright install --with-deps chromium webkit`
17. `pnpm test:e2e`

> Cette liste ne decrivait pas le workflow reel avant le 2026-07-27 : elle mentionnait un
> unique `pnpm docs:check` la ou quatre gardes documentaires distinctes tournent, et un
> `PLAYWRIGHT_SKIP_BUILD=1 pnpm test:e2e` que `ci.yml` n'a jamais porte. Corrigee sur
> lecture du fichier.

Ordre de severite retenu:

- la coherence documentaire canonique doit etre validee avant le reste du gate
- le garde-fou sandbox-only doit bloquer toute introduction de `ck_live_*`
- les tests executables passent avant les controles purement statiques
- le build reste obligatoire pour verifier le runtime Next/Vercel
- les smokes navigateur Playwright doivent ensuite verifier le tunnel critique, le repli retour vers logout et le tunnel protege mobile sur le build produit, sur les projets Playwright actives dans `playwright.config.ts`

Note locale:

- `PLAYWRIGHT_SKIP_BUILD=1 pnpm test:e2e` est reserve a la CI apres `pnpm build`
- apres une modification UI locale, relancer au moins une fois `pnpm test:e2e` sans `PLAYWRIGHT_SKIP_BUILD=1` pour eviter un `.next` stale

## Audit de securite des dependances

Ce depot a ete le dernier des cinq sans aucune barriere d'audit : ni etape CI, ni cron, ni `dependabot.yml`. La premiere mesure, le 2026-07-27, a trouve **13 avis `high` et 8 `moderate` reels** sur 340 paquets, dont quatre `high` sur `next` lui-meme.

### La barriere — `scripts/security/audit-pnpm-tree.mjs`

Elle lit les versions que **pnpm a reellement resolues** dans `pnpm-lock.yaml`, les soumet a l'endpoint bulk du registre, et decompresse elle-meme le gzip que celui-ci renvoie sans en-tete `content-encoding`. Deux raisons de ne pas se contenter de `npm audit` ou `pnpm audit`, mesurees sur les quatre autres depots :

- npm ignore `pnpm.overrides` et reconstruit un arbre que pnpm ne produit jamais — 16 avis `high` reels y etaient invisibles ;
- le gzip non declare fait echouer `pnpm audit`, `npm audit` et le `fetch` de Node a l'identique, des que la reponse depasse une certaine taille.

Elle bloque sur `high`/`critical` et **affiche** les avis sous ce seuil sans jamais les jeter. Elle echoue en bloquant sur toute anomalie — reseau, HTTP non-2xx, corps vide, lockfile illisible : l'absence de signal d'erreur n'est jamais interpretee comme un succes.

### Ce qui a ete corrige le 2026-07-27

| Paquet | Avant | Apres | Moyen |
|---|---|---|---|
| `next` | 16.2.6 (4 `high`, 5 `moderate`) | 16.2.12 | montee de la dependance directe |
| `postcss` | 8.4.31 et 8.5.14 (2 `high`) | >=8.5.18 | override global — meme majeure |
| `sharp` | 0.34.5 (1 `high`) | 0.35.3 | override borne `>=0.35.0 <0.36.0` |
| `js-yaml` | 4.1.1 (1 `high`) | >=4.3.0 | override borne `<5` |
| `vite` | 8.0.13 (1 `high`) | 8.1.5 | **declaration explicite en devDependency** |
| `brace-expansion` | 1.1.14 et 5.0.6 (3 `high`) | 1.1.16 et 5.0.8 | overrides **scopes** par parent |

Trois pieges rencontres, tous verifies et non supposes :

- **Les overrides pnpm ne s'appliquent pas aux peers auto-installes.** `vite` n'est tire que comme peer de `vitest` ; l'override `vite: ">=8.0.16"` restait sans effet, meme apres `pnpm install --force`. La reponse est de declarer `vite` en devDependency — on controle la version de ce qu'on utilise reellement. Accessoirement, `vite@8.0.16` n'existe pas : la ligne 8.0.x s'arrete a 8.0.15 et le correctif est en 8.1.0.
- **Une valeur eprouvee sur un autre depot n'est pas une valeur valide ici.** L'override `js-cookie: ">=3.0.7"`, repris tel quel de dashboard-node, a fait echouer `pnpm build` : `amazon-cognito-identity-js` importe `get`/`set`/`remove` en exports nommes, que js-cookie v3 n'expose plus. Le parent differe, donc la valeur aussi.
- **`sharp` sort de la plage declaree par `next`** (`^0.34.5`). C'est assume et signale : `next/image` est utilise par cette application, donc l'exposition est reelle et un scellement serait malhonnete. Le build et les smokes Playwright sont la verification.

### L'angle mort des paquets scopes, corrige le 2026-07-27

La premiere version de la barriere n'auditait **que les paquets non scopes**. pnpm entoure de quotes les cles dont le nom est scope dans `pnpm-lock.yaml` (`  '@babel/core@7.29.0':`), et le motif d'extraction refusait ce guillemet. Consequence : sur ce depot, 350 entrees scopees sur 1103 n'etaient jamais soumises au registre — sans qu'aucun message ne le signale, puisque le script lisait bien des paquets.

Detecte par ecart : Dependabot signalait `GHSA-4x5r-pxfx-6jf8` sur `@babel/core@7.29.0` alors que la barriere annoncait « 0 avis sous le seuil ». Ce genre de divergence merite toujours d'etre creuse — c'est la deuxieme fois qu'un avis n'existe que dans l'interface Dependabot, et la premiere fois c'etait aussi un defaut de notre cote.

Apres correction : **507 paquets audites au lieu de 340**. La mesure a ete refaite sur les quatre autres depots, ou la surface double egalement (355 → 727, 437 → 777, 389 → 681, 264 → 522) sans faire apparaitre de nouvel avis — ils portaient deja l'override `@babel/core` pose depuis les alertes Dependabot.

### Les deux scellements, et leur precondition

Deux avis restent, tous deux `high`, tous deux scelles — **et chaque scellement porte une fonction reevaluee a chaque execution**. Si sa premisse tombe, il s'annule et l'avis redevient bloquant. Un scellement qui ne se verifie pas est un mensonge differe.

| Avis | Motif | Ce qui l'annule |
|---|---|---|
| `GHSA-qjx8-664m-686j` — `js-cookie <=3.0.5` | dans `amazon-cognito-identity-js`, js-cookie n'est importe que par `CookieStorage.js`, que cette application n'utilise jamais : `CognitoUserPool` est construit sans option `Storage`, donc la bibliotheque retombe sur `localStorage` | tout fichier de `src/` ou `app/` qui reference `CookieStorage` ou `js-cookie`, ou qui passe une option `Storage` a Cognito |
| `GHSA-mh99-v99m-4gvg` — `brace-expansion <=5.0.7` | la branche v5 est forcee en >=5.0.8 ; la branche v1, imposee par `minimatch@3`, s'arrete a 1.1.16 ou cet avis n'a aucun correctif. La forcer en v5 casse `minimatch@3` (`TypeError: expand is not a function`). `minimatch@3` ne vient que de la chaine ESLint, absente de l'artefact deploye | une version v5 retombee sous 5.0.8, ou un consommateur de `minimatch@3` hors chaine ESLint |

Les deux chemins ont ete prouves par execution avant livraison : premisse vraie → sortie verte ; premisse tombee → scellement annule, avis bloquant, code de sortie 1.

> **Depuis le 2026-08-09, le scellement `brace-expansion` ne se declenche plus.** Un correctif est
> paru sur la branche v1 — 1.1.18 — alors que le motif du scellement affirmait qu'il n'en existait
> aucun. Le plancher a donc ete remonte et l'avis n'a plus lieu d'etre scelle. La fonction de
> precondition reste en place : elle ne coute rien et se rearme d'elle-meme si une version v5
> retombait sous 5.0.9.

### Ce qui a ete corrige le 2026-08-09

Trois avis `high` parus **apres** le dernier passage vert, donc sur des paquets deja installes, sans
qu'aucun fichier du depot ait bouge. C'est exactement le cas que `security-audit.yml` existe pour
attraper.

| Paquet | Avis | Avant | Apres | Moyen |
|---|---|---|---|---|
| `nanoid` | `GHSA-2v37-7h3g-55p8` (`<3.3.17`) | 3.3.16 | 3.3.18 | override **scope** `postcss>nanoid` |
| `js-yaml` | `GHSA-5p4m-2wfm-xmqj` (`<4.3.1`) | 4.3.0 | 4.3.1 | plancher remonte d'un cran, borne `<5` |
| `brace-expansion` | `GHSA-rgw5-rvv9-x895` (`<1.1.18`) | 1.1.16 | 1.1.18 | plancher scope `minimatch@3>brace-expansion` |

Aucun scellement : dans les trois cas une version corrigee existe **dans la plage declaree par le
parent**, donc le plancher suffit et sceller serait un mensonge. Le plancher `nanoid` est scope a
`postcss`, son seul consommateur, pour ne pas contraindre un futur `nanoid` 5 ailleurs dans l'arbre.
Le plancher v5 de `brace-expansion` est passe de 5.0.8 a 5.0.9 au passage, pour aligner les cinq
depots sur une seule valeur.

Les cinq depots portaient les memes versions resolues et recoivent le meme correctif.

### L'audit planifie — `.github/workflows/security-audit.yml`

L'audit de `ci.yml` n'a pas d'horloge : un avis publie sur un paquet **deja installe** ne declenche rien, puisque ni le lockfile ni le code n'ont bouge. `security-audit.yml` rejoue la barriere chaque lundi a 05:00 UTC, et reste declenchable a la main.

Il compte double ici : les deux scellements ci-dessus reposent sur des preconditions. Sans passage regulier, une premisse pourrait tomber sans que rien ne le signale avant la prochaine PR.

Le job declare `environment: vercel-preview` : `GH_PACKAGES_TOKEN` existe au niveau depot **et** dans les deux environnements, avec des valeurs potentiellement differentes.

### Dependabot — `.github/dependabot.yml`

Deux volets, hebdomadaires : `github-actions` et `npm`. Le volet npm passe par le bloc `registries:` pour resoudre les `@kycly/*` sur `npm.pkg.github.com`, et ignore ces memes paquets — ils sont publies par nos soins.

**Ce qu'il ne fera pas** : corriger une dependance transitive. Son job declare `update-subdependencies: false`, et l'option `dependency-type: indirect` n'existe pas pour l'ecosysteme npm — seulement pour bundler, pip, composer, cargo, gomod et uv. Aucun reglage ne change cela. Les transitives se corrigent par un plancher dans `pnpm.overrides`, **borne** sous la majeure suivante.

### Derive de la branche de deploiement — `.github/workflows/branch-drift.yml`

Le deploiement de ce depot n'est pas un workflow GitHub : il est natif Vercel. `main` alimente les previews, `production` le deploiement de production. Seule `production` est donc une branche longue duree a surveiller.

Le workflow mesure chaque lundi a 05:15 UTC l'**ecart de contenu** entre `production` et `main` — et non le nombre de commits, qui ment sur une branche de deploiement pleine de merges dont le contenu est deja dans la reference. Il echoue si le plus ancien commit non reporte depasse 14 jours. Il n'a que `contents: read` et ne merge rien : un push sur `production` declenche un deploiement Vercel reel, le rattrapage reste un geste humain.

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
- les changements sur le shell mobile-first, l'installabilite PWA ou l'ergonomie du tunnel KYC critique doivent aussi mettre a jour [../reference/PWA-MOBILE-FIRST-CONTRACT.md](../reference/PWA-MOBILE-FIRST-CONTRACT.md)

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
- garde-fou CI : toute PR ouverte vers `production` depuis une branche autre que `main` echoue
  immediatement (job `quality`, etape "Guard production PR source") — corrige le dephasage recurrent
  ou des PR de contenu/hotfix etaient ouvertes directement vers `production` (cf. incidents #4/#6/#13)
  au lieu de passer par une promotion `production <- main`
- securite : la valeur `github.head_ref` (nom de branche, controle par l'auteur de la PR) ne doit
  jamais etre interpolee directement dans un bloc `run:` (`${{ ... }}` inline) — injection de script
  CI/CD possible ; elle doit transiter par une variable d'environnement (`env: HEAD_REF: ${{
  github.head_ref }}`) avant d'etre lue en shell (`$HEAD_REF`)

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
- `KYCLY_BASE_URL`
- `DEFAULT_KYCLINK_THEME` si override necessaire

### Politique retenue

- `APP_SESSION_SECRET` doit etre distinct entre `Preview` et `Production`
- `APP_CANONICAL_ORIGIN` doit pointer vers le host public qui doit etre autorise a embarquer KycLink; si vide, l'app derive l'origine depuis les headers forwardes / `host`
- `NODE_AUTH_TOKEN` doit etre present dans Vercel `Preview` et `Production` si le build installe `@kycly/link`
- `KYCLY_BASE_URL` pointe vers `partner-node sandbox` pour `POST /kyclink/create` et `GET /kyclink/:sessionId` en `Preview` et `Production`. **Requise au sens strict depuis ENV-057** : sans elle le build echoue, la ou il tombait auparavant sur `https://api.kycly.sn` (domaine qui ne resout pas). La CI pose la meme variable ; les trois noms qu'elle posait avant (`KYCLY_API_BASE_URL`, `KYCLY_SESSION_BASE_URL`, `KYCLY_ME_BASE_URL`) n'etaient lus par aucun code et ont ete retires. Le hook `pre-push` construit lui aussi : il charge `.env.local` s'il existe, et refuse de pousser avec un message explicite si `KYCLY_BASE_URL` reste absente — un poste de developpement doit poser la variable comme la CI et Vercel.
- l'id token Cognito reste strictement cote serveur dans la session HTTP-only

### Invariant J1

Pour `Preview` comme pour `Production`:

- `KYCLY_BASE_URL` -> runtime sandbox de `partner-node` pour `/kyclink/*`
- `APP_CANONICAL_ORIGIN` -> host public autorise pour l'iframe KycLink, ou vide pour derivation proxy / host
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
6. lecture resultat `/api/kyc/session/:sessionId`
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