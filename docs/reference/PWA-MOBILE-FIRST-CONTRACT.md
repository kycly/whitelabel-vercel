# Référence — Contrat PWA Mobile-First

Ce document fixe le contrat UI/UX et les invariants du shell PWA mobile-first de `whitelabel-vercel`.

## 1. Cadrage

Le périmètre reste volontairement minimal:

- shell mobile-first unifié
- installabilité PWA
- tunnel KYC prioritaire en mobile
- aucun changement backend
- aucun mode offline métier

## 2. Invariants non négociables

L'application ne doit jamais:

- modifier les routes `/api/auth/*`
- modifier les routes `/api/kyc/*`
- modifier le contrat `partner-node`
- modifier le handshake parent-origin de KycLink
- introduire un cache applicatif sur auth, session, KYC ou iframe
- créer une vue desktop parallèle
- réintroduire une dépendance visuelle cross-project

## 3. Canon UI/UX

Règles globales:

- mobile-first partout
- une seule logique de lecture sur tous les écrans
- une seule colonne sur les flows critiques
- desktop = version mobile plus aérée, jamais une autre app
- CTA principal toujours lisible et atteignable
- safe areas gérées partout
- aucun conflit de scroll entre document, shell et contenu critique
- les écrans critiques à footer ou actions persistantes utilisent un viewport verrouillé avec body interne scrollable

## 4. Priorité absolue: écran KYC

L'écran qui embarque KycLink est prioritaire.

Il doit:

- maximiser la hauteur utile
- réduire le chrome concurrent
- éviter tout scroll parasite
- verrouiller le viewport du shell pour réserver la hauteur utile au conteneur iframe
- rester lisible en navigateur mobile comme en mode installé
- préserver strictement le handshake parent-origin existant
- supprimer tout header, titre éditorial, bouton retour ou action de déconnexion concurrente pendant l'affichage réel de l'iframe
- conserver le même contrat de tunnel sur tous les breakpoints, sans variante desktop dédiée du parcours

Les écrans `WELCOME`, `SESSION_CONTEXT`, `SESSIONS` et `COMPLETE` suivent le même principe: header fixe, body interne scrollable, footer ou actions séparés du contenu principal.

`SESSION_PREPARE` et `SESSION_GATE` restent courts, centrés et sans bruit éditorial. `SESSION_GATE` ne doit pas réintroduire le titre de parcours quand il prépare l'ouverture de l'iframe.

Politique d'erreur protégée associée:

- le shell ne conserve pas un écran critique affiché avec un état expiré si une route protégée renvoie `401` ou `UNAUTHORIZED`
- dans ce cas, le flux replie vers le logout centralisé plutôt que de laisser un message inline persistant sur le tunnel
- `ACCESS_DENIED` reste la seule sortie d'autorisation dédiée
- `FAILURE` reste la sortie commune des erreurs de parcours protégées hors auth

## 5. Fichiers cibles

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
- aucun service worker tant qu'une politique de cache strictement statique n'est pas validée de bout en bout

## 6. Politique PWA stricte

Le shell PWA ne doit mettre en cache que le strict nécessaire statique.

Configuration actuelle:

- metadata mobile/PWA dans `app/layout.tsx`
- manifest web app dédié
- icônes statiques versionnées dans `public/`
- aucun cache métier

Doivent rester hors cache:

- `/api/auth/*`
- `/api/kyc/*`
- les lectures de sessions en cours
- les pages et flux KYC dynamiques
- toute interaction de l'iframe KycLink

## 7. Critères de conformité

L'application est conforme si:

- le flow KYC reste intact
- le rendu mobile est meilleur sans régression desktop
- l'app est installable proprement
- aucune logique backend n'a changé
- aucune dette de cache n'a été introduite
- l'esthétique reste sobre, spécifique et non générique

Refuser la livraison si l'un des symptômes suivants apparaît:

- régression de hauteur ou de scroll sur l'écran KYC
- CTA masqué par le clavier mobile
- double scroll dans le tunnel
- bandeau, titre ou chrome résiduel au-dessus de l'iframe pendant `KYC_LINK`
- écran protégé laissé actif avec simple bannière d'erreur alors qu'une redirection de sécurité devait se produire
- service worker interférant avec auth ou KYC
- apparition d'une variante desktop séparée
- rendu visuel trop générique ou démonstratif

## 8. Références associées

- [UI-ESTHETIC-CANON.md](./UI-ESTHETIC-CANON.md)
- [KYCLINK-SDK-INTEGRATION.md](./KYCLINK-SDK-INTEGRATION.md)