# Runbook — Gouvernance GitHub et configuration Vercel

Reference operatoire exacte pour configurer les protections de branches, les GitHub Environments et le projet Vercel de `whitelabel-vercel`.

Contexte reel retenu:

- repository GitHub heberge dans une organisation
- projet Vercel heberge dans un compte personnel

Ce document complete:

- [cicd-workflow.md](cicd-workflow.md)
- [env-vars-lifecycle.md](env-vars-lifecycle.md)
- [remote-setup-clickpath.md](remote-setup-clickpath.md)

Il decrit les reglages distants a appliquer. Ces reglages ne sont pas portables nativement sous forme de code dans ce repository, sauf les fichiers GitHub d'accompagnement comme le template de pull request.

Pour l'execution ecran par ecran, suivre [remote-setup-clickpath.md](remote-setup-clickpath.md).

---

## Objectif

Mettre le repository et Vercel dans l'etat cible suivant:

- protection forte de `main`
- protection forte de `production`
- CI GitHub obligatoire avant merge
- previews Vercel visibles et exploitables
- deploiement production reserve a la branche `production`
- gouvernance explicite des secrets et environnements

---

## Ce qui est versionne dans le repo

Le repo porte maintenant les elements GitHub suivants:

- [ci.yml](../../.github/workflows/ci.yml)
- [PULL_REQUEST_TEMPLATE.md](../../.github/PULL_REQUEST_TEMPLATE.md)

Role retenu:

- `ci.yml` fournit le quality gate obligatoire
- `PULL_REQUEST_TEMPLATE.md` impose une hygiene minimale de revue, de verification et de promotion

---

## Ce qui reste a configurer a distance

Les elements suivants doivent etre regles dans GitHub et Vercel:

- protections de branches
- GitHub Environments
- secrets GitHub Environments si utilises
- liaison Git Vercel
- root directory Vercel
- variables Vercel `Preview` et `Production`
- branche de production Vercel
- configuration du client Cognito dedie

Note de contexte:

- cote GitHub, une partie de la gouvernance peut etre imposee par l'organisation via des rulesets ou des restrictions supplementaires
- cote Vercel, les reglages sont attendus au niveau du projet personnel, sans couche team obligatoire

---

## Protection de branche `main`

Configurer `main` avec les regles suivantes:

- pull request obligatoire avant merge
- au moins 1 approbation obligatoire
- dismissal des approvals stale active
- resolution de toutes les conversations obligatoire
- status check obligatoire: `quality`
- branche a jour requise avant merge
- push direct interdit
- force push interdit
- deletion interdite

Merge autorises:

- squash merge: autorise
- rebase merge: au choix de l'equipe
- merge commit: a desactiver si vous voulez un historique strict

Recommendation retenue:

- autoriser uniquement `squash merge` pour garder une promotion lisible vers `production`

---

## Protection de branche `production`

Configurer `production` avec les regles suivantes:

- pull request obligatoire avant merge
- au moins 1 approbation obligatoire
- resolution de toutes les conversations obligatoire
- status check obligatoire: `quality`
- branche a jour requise avant merge
- push direct interdit
- force push interdit
- deletion interdite
- restriction de merge aux maintainers autorises si GitHub le permet sur votre plan

Regle d'exploitation retenue:

- `production` ne recoit qu'une promotion intentionnelle depuis `main` ou un lot explicitement prepare pour publication

---

## GitHub Environment `vercel-preview`

Creer un environnement GitHub nomme:

- `vercel-preview`

Reglages retenus:

- secret `GH_PACKAGES_TOKEN` disponible
- pas d'approbation manuelle obligatoire
- environnement utilise par les PR et les pushes hors production dans `ci.yml`

Usage:

- resoudre `@kycly/link` via GitHub Packages pendant la CI
- porter les secrets specifiques preview si vous decidez de sortir certaines valeurs du workflow

---

## GitHub Environment `vercel-production`

Creer un environnement GitHub nomme:

- `vercel-production`

Reglages retenus:

- secret `GH_PACKAGES_TOKEN` disponible
- approbation manuelle recommandee si vous attachez plus tard des jobs sensibles a cet environnement
- environnement utilise par les pushes sur `production` dans `ci.yml`

Note:

- dans l'etat actuel, le workflow CI ne deploie pas. L'environnement sert surtout a gouverner les secrets et a preparer la suite.

---

## Secrets GitHub minimaux

Secrets retenus:

| Nom | Scope recommande | Usage |
|---|---|---|
| `GH_PACKAGES_TOKEN` | `vercel-preview` et `vercel-production` | installer les packages prives depuis GitHub Packages |

Regle retenue:

- utiliser un PAT lecture seule avec scope `read:packages`

---

## Configuration du projet Vercel

### Liaison Git

Dans Vercel:

1. importer le repository GitHub qui contient `whitelabel-vercel`
2. verifier que Vercel a acces au repository cible
3. confirmer que les PR generent bien des previews

### Root directory

Configurer:

- root directory: `whitelabel-vercel`

### Framework preset

Configurer:

- framework: `Next.js`

### Commandes retenues

Configurer ou verifier:

- install command: `pnpm install --frozen-lockfile`
- build command: `pnpm build`
- output directory: detection automatique Vercel pour Next.js

### Production branch

Configurer:

- production branch: `production`

### Preview branch behavior

Verifier:

- previews actives sur les PR
- previews actives sur les branches hors `production`

---

## Variables Vercel a configurer

La reference detaillee reste [env-vars-lifecycle.md](env-vars-lifecycle.md).

Appliquer au minimum:

### Environment `Preview`

- `NEXT_PUBLIC_APP_ENV=preview`
- `NEXT_PUBLIC_AWS_REGION`
- `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `APP_SESSION_SECRET`
- `KYCLY_API_BASE_URL` vers `partner-node sandbox` pour `/kyclink/*`
- `KYCLY_ME_BASE_URL` vers l'hote exposant `/demo/me`
- `DEMO_ACCOUNT_KEY_MAP` avec `ck_demo_*` seulement
- `DEFAULT_KYCLINK_THEME` si necessaire

### Environment `Production`

- `NEXT_PUBLIC_APP_ENV=production`
- `NEXT_PUBLIC_AWS_REGION`
- `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `APP_SESSION_SECRET`
- `KYCLY_API_BASE_URL` vers `partner-node sandbox` pour `/kyclink/*`
- `KYCLY_ME_BASE_URL` vers l'hote exposant `/demo/me`
- `DEMO_ACCOUNT_KEY_MAP` avec `ck_demo_*` seulement
- `DEFAULT_KYCLINK_THEME` si necessaire

Invariant obligatoire:

- aucune `ck_live_*`
- aucune cible `partner-node production`

---

## Configuration Cognito a verifier

Dans l'app client Cognito dediee a `whitelabel-vercel`, verifier:

- l'association au bon user pool
- l'activation du flux d'authentification retenu pour le login direct
- la coherence entre region, user pool et app client id diffuses a Vercel

---

## Checklist de mise en place GitHub

- [ ] creer `vercel-preview`
- [ ] creer `vercel-production`
- [ ] charger `GH_PACKAGES_TOKEN` dans les environnements GitHub requis
- [ ] proteger `main`
- [ ] proteger `production`
- [ ] imposer le status check `quality`
- [ ] interdire le push direct sur `production`
- [ ] verifier que les PR utilisent le template [PULL_REQUEST_TEMPLATE.md](../../.github/PULL_REQUEST_TEMPLATE.md)

---

## Checklist de mise en place Vercel

- [ ] importer le repository GitHub correct
- [ ] definir `whitelabel-vercel` comme root directory
- [ ] verifier le preset `Next.js`
- [ ] definir `production` comme production branch
- [ ] activer les previews Vercel
- [ ] charger toutes les variables `Preview`
- [ ] charger toutes les variables `Production`
- [ ] verifier que `KYCLY_API_BASE_URL` pointe sur `partner-node sandbox` pour `/kyclink/*`
- [ ] verifier que `KYCLY_ME_BASE_URL` pointe sur l'hote exposant `/demo/me`
- [ ] verifier que `DEMO_ACCOUNT_KEY_MAP` ne contient que des `ck_demo_*`

---

## Checklist de verification finale

- [ ] ouvrir une PR vers `main`
- [ ] confirmer l'execution du workflow `ci`
- [ ] confirmer l'apparition de la preview Vercel
- [ ] verifier login preview
- [ ] verifier creation de session KYC preview
- [ ] merger vers `main`
- [ ] promouvoir intentionnellement vers `production`
- [ ] confirmer le deploiement Vercel `Production`
- [ ] verifier login production
- [ ] verifier creation et lecture de session en production applicative, toujours contre sandbox

---

## Decision finale retenue

L'etat cible de gouvernance est donc:

- protections fortes sur `main` et `production`
- `quality` obligatoire avant merge
- template de PR versionne dans le repo
- GitHub Environments `vercel-preview` et `vercel-production`
- projet Vercel dedie avec branche de production `production`
- previews actives pour les PR
- variables runtime gouvernees par Vercel
- application toujours `sandbox-only` au J1

Ce runbook est la checklist operative a suivre pour finir la mise en place distante.