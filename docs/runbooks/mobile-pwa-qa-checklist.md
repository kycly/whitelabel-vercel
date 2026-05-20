# Runbook — QA mobile et PWA

Ce runbook sert a verifier le shell mobile-first et la couche PWA minimale de `whitelabel-vercel`.

Il couvre uniquement ce repo.

## Objectif

Verifier que:

- le shell mobile-first reste stable sur iPhone Safari et Android Chrome
- le tunnel KYC conserve sa hauteur utile et son comportement de confiance
- l'installabilite PWA n'introduit aucune dette runtime
- les ecrans transitoires et les ecrans d'erreur restent coherents avec le canon UI local

## Perimetre a tester

Ecrans critiques:

- `LOGIN`
- `AUTH_LOADING`
- `ACCESS_DENIED`
- `WELCOME`
- `SESSION_CONTEXT`
- `SESSION_PREPARE`
- `KYC_LINK`
- `COMPLETE`
- `SESSIONS`
- `FAILURE`

## Navigateurs cibles

Validation minimale recommandee:

1. iPhone Safari
2. Android Chrome
3. Chromium desktop etroit

Validation complementaire utile:

1. PWA installee iOS
2. PWA installee Android
3. projet Playwright `webkit` pour une couverture automatisee WebKit de base, en complement des verifications manuelles Safari iPhone

## Pre-check local

Executer au minimum:

1. `pnpm build`
2. `pnpm test:e2e -- e2e/whitelabel-smoke.spec.ts`
3. `pnpm test:e2e -- e2e/whitelabel-mobile-auth.spec.ts`
4. `pnpm test:e2e -- e2e/auth-fallback-logout.spec.ts`
5. `pnpm docs:check`

## Checklist shell mobile-first

- le shell remplit bien la hauteur utile mobile
- aucune zone blanche parasite n'apparait en haut ou en bas
- les safe areas ne coupent ni header ni CTA
- le desktop reste une version mobile aeree, pas une vue differente
- aucun ecran protege ne laisse le document global defiler quand un body scrollable interne est prevu

## Checklist login et auth

- `LOGIN` garde le formulaire dans la zone utile sans hero envahissant
- le CTA principal reste visible ou rapidement atteignable au clavier mobile
- `AUTH_LOADING` reste un etat court, centre et sobre
- `ACCESS_DENIED` reste lisible, sans chrome concurrent, avec une seule sortie claire
- le fallback logout -> login fonctionne sans reliquat de session

## Checklist session context

- `External ID` et `Notification SMS` restent visibles sans scroller loin
- le bouton de generation d'`External ID` reste atteignable en mobile
- le footer `Creer la session` reste visible ou atteignable avec le clavier ouvert
- l'ouverture des groupes optionnels conserve le scroll dans le body interne de `SESSION_CONTEXT`
- la suppression d'un groupe ne casse pas la position courante de lecture

## Checklist tunnel KYC

- `SESSION_PREPARE` reste un sas tres court et centre
- `SESSION_GATE` reste un etat de reprise compact et sans bruit visuel
- `KYC_LINK` maximise la hauteur utile de l'iframe
- aucun padding ou bandeau ne reduit artificiellement l'espace du parcours
- aucun bouton retour ou deconnexion ne reapparait dans `KYC_LINK`
- le parcours reprend toujours correctement une session `ACTIVE`

## Checklist resultat et historique

- `COMPLETE` reste lisible en mobile sans ressembler a un dashboard technique
- les actions rapides de `COMPLETE` gardent un format compact et stable
- `SESSIONS` conserve ses 3 cartes metriques sur la meme ligne
- les filtres et les actions rapides restent manipulables sur petit viewport
- `Reprendre` et `Voir le resultat` restent distincts et lisibles

## Checklist PWA

- le manifest est bien servi
- les icones sont resolues correctement
- l'app peut etre ajoutee a l'ecran d'accueil
- l'app demarre sur `/welcome`
- aucun service worker ne s'interpose sur `auth` ou `kyc`
- l'installabilite ne change pas le comportement du tunnel KYC

## Critere de refus

Refuser la livraison si l'un de ces cas apparait:

- conflit de scroll entre document, shell et body principal d'un ecran critique
- CTA masque par le clavier mobile
- regression Safari iPhone sur le parcours KYC
- perte d'espace utile dans l'iframe
- rendu visuel trop generique ou “IA par defaut”
- symptome de cache PWA sur des routes metier ou d'authentification

## Decision actuelle

La configuration PWA retenue dans `whitelabel-vercel` comprend:

- metadata mobile/PWA
- manifest dedie
- icones statiques
- aucun service worker

Toute extension future du perimetre PWA doit repasser par [../reference/PWA-MOBILE-FIRST-CONTRACT.md](../reference/PWA-MOBILE-FIRST-CONTRACT.md).