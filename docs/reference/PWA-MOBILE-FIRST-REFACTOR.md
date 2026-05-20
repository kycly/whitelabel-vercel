# Référence — Refactor PWA Mobile-First

Ce document fige le périmètre, les règles UI/UX et les contraintes d'implémentation du refactor PWA mobile-first de `whitelabel-vercel`.

Objectif:

- rendre l'application installable et plus native en mobile
- améliorer nettement l'expérience UI/UX sans changer le métier
- garder le flow KYC actuel strictement intact
- éviter toute dette technique, tout faux offline et toute divergence frontend/backend

## 1. Décision de cadrage

Le refactor vise une **PWA shell complète mais minimaliste**.

Cela signifie:

- installabilité propre
- shell mobile-first cohérent
- responsive unifié sur tous les écrans
- priorité absolue au tunnel KYC mobile
- aucun changement backend
- aucun changement du contrat KycLink
- aucun mode offline métier

Le refactor est donc **frontend-only**, centré sur `whitelabel-vercel`.

## 2. Invariants non négociables

Le refactor ne doit jamais:

- modifier les routes `/api/auth/*`
- modifier les routes `/api/kyc/*`
- modifier le contrat `partner-node`
- modifier le handshake parent-origin de KycLink
- modifier la logique métier des écrans
- introduire un cache applicatif sur auth, session, KYC ou iframe
- créer une vue desktop parallèle
- réintroduire une dépendance visuelle cross-project

## 3. Scope final retenu

Le périmètre final comprend obligatoirement:

1. shell global mobile-first
2. canon layout unifié
3. tunnel KYC traité en priorité absolue
4. harmonisation des écrans satellites
5. installabilité PWA
6. politique de cache stricte et minimale

Le périmètre exclut explicitement:

- mode offline de vérification
- cache métier des endpoints applicatifs
- refonte backend/auth
- variante desktop dédiée
- artifices “app-like” qui cassent le flow réel

## 4. Direction esthétique

La direction visuelle à conserver et à pousser est la suivante:

- confiance
- clarté
- sérieux opérationnel
- fluidité mobile

Le résultat attendu n'est ni un dashboard administratif froid, ni une landing page startup, ni une application gadget.

Le produit doit évoquer:

- contrôle d'identité moderne
- procédure assistée
- calme
- lisibilité
- précision

## 5. Directive anti rendu IA

Le refactor ne doit **jamais** produire une interface “AI vibe coding like”, c'est-à-dire une interface immédiatement reconnaissable comme générée ou stylisée par une IA générique.

Sont explicitement interdits:

- les compositions interchangeables et sans identité
- les gradients tape-à-l'oeil utilisés par défaut
- les cartes trop molles ou trop décoratives
- les hiérarchies visuelles génériques de landing page SaaS
- les micro-animations gratuites ou démonstratives
- les choix de style qui semblent “beaux par défaut” mais sans rapport avec le produit
- les interfaces qui ressemblent à un template générique de no-code ou de vibe coding

Le design doit au contraire être:

- spécifique au produit de vérification d'identité
- sobre mais reconnaissable
- premium sans être ostentatoire
- structuré par le métier et non par un effet de mode visuel

## 6. Canon UI/UX attendu

Règles globales:

- mobile-first partout
- une seule logique de lecture sur tous les écrans
- une seule colonne sur tous les flows critiques
- desktop = version mobile aérée, jamais une autre app
- CTA principal toujours lisible et atteignable
- safe areas gérées partout
- chrome minimal autour de l'iframe
- aucun scroll imbriqué dans le flow principal

Le responsive attendu repose sur:

- mêmes composants
- même ordre de lecture
- mêmes intentions par écran
- seules changent la largeur utile, la densité et les espacements

## 7. Priorité absolue: écran KYC

Le succès du refactor se joue d'abord sur l'écran qui embarque KycLink.

Cet écran doit:

- maximiser la hauteur utile
- réduire le chrome concurrent
- éviter tout scroll parasite
- rester parfaitement lisible en mobile navigateur et en mode installé
- préserver strictement le handshake parent-origin déjà en place

Si ce point n'est pas traité correctement, la PWA sera esthétiquement meilleure mais fonctionnellement moins bonne.

## 8. Fichiers cibles du refactor

Shell et layout:

- `app/layout.tsx`
- `src/components/layout/page-shell.tsx`
- `src/components/layout/protected-screen-shell.tsx`
- `src/components/ui/fixed-action-layout.ts`

Tunnel KYC:

- `src/components/verify/verification-run-screen.tsx`
- `src/components/verify/verification-session-gate.tsx`
- `src/components/verify/verification-prepare-screen.tsx`
- `src/components/verify/verification-workspace.tsx`

Écrans satellites:

- `src/components/screens/login-screen.tsx`
- `src/components/screens/welcome-screen.tsx`
- `src/components/verify/verification-complete.tsx`
- `src/components/screens/failure-screen.tsx`
- `src/components/verify/verification-sessions.tsx`

Couche PWA:

- `app/layout.tsx`
- `public/*`
- manifest web app
- service worker minimal si retenu

## 9. Règles PWA strictes

Le shell PWA ne doit mettre en cache que le strict nécessaire statique.

Premier lot retenu et recommande:

- metadata mobile/PWA dans `app/layout.tsx`
- manifest web app dedie
- icones statiques versionnees dans `public/`
- aucun service worker tant qu'une politique de cache strictement statique n'est pas testee de bout en bout

Doivent rester hors cache métier:

- `/api/auth/*`
- `/api/kyc/*`
- les lectures de sessions en cours
- les pages et flux KYC dynamiques
- toute interaction de l'iframe KycLink

La PWA ne doit pas promettre une expérience offline sur le tunnel de vérification.

## 10. Critères de réussite

Le refactor est considéré réussi si:

- l'app reste fonctionnellement identique
- le flow KYC reste intact
- le rendu mobile est nettement meilleur
- le rendu desktop reste cohérent sans vue parallèle
- l'app est installable proprement
- aucune logique backend n'a changé
- aucune dette de cache ou de compatibilité n'a été introduite
- l'esthétique finale est identifiable, sobre et non générique

## 11. Critères de refus

Le refactor doit être refusé si l'un des symptômes suivants apparaît:

- régression de hauteur ou de scroll sur l'écran KYC
- CTA masqué par le clavier mobile
- double scroll dans le tunnel
- service worker interférant avec auth ou KYC
- apparition d'une variante desktop séparée
- rendu visuel trop générique, démonstratif ou “IA par défaut”
- ajout d'effets visuels non motivés par l'usage

## 12. Références associées

- [UI-ESTHETIC-CANON.md](./UI-ESTHETIC-CANON.md)
- [KYCLINK-SDK-INTEGRATION.md](./KYCLINK-SDK-INTEGRATION.md)
- [SESSION-CONTEXT-UX.md](./SESSION-CONTEXT-UX.md)
- [AUTH-UX.md](./AUTH-UX.md)