---
status: accepted
date: 2026-07-21
deciders: [tech-lead]
supersedes: null
---

# ADR 001 : Pourquoi le flux Cognito direct

## Contexte

`whitelabel-vercel` authentifie des utilisateurs **déjà provisionnés** dans le user pool Cognito de
`partner-node`. Il fallait un mécanisme de login simple, sans backoffice de provisioning, qui garde le
token hors du navigateur et permette d'appeler `partner-node /kyclink/*` au nom de l'utilisateur.

## Décision

Login **Cognito direct** depuis un formulaire de l'app (`amazon-cognito-identity-js`), **vérification
serveur** du JWT, puis stockage de l'`idToken` dans un **cookie HTTP-only signé** (jose, HS256). Le token
Cognito n'est jamais exposé au client ; il est réutilisé côté serveur pour `/demo/me` et `/kyclink/*`.

## Conséquences

### ✅ Positives

- Aucun secret ni token exposé au navigateur.
- Pas de callback/redirection OAuth à maintenir.
- Le même JWT sert d'identité pour tous les appels serveur vers partner-node.

### ❌ Négatives (acceptées)

- Le login par mot de passe direct suppose des utilisateurs pré-provisionnés (pas de self-signup).
- Le cookie applicatif porte le token Cognito → durée de vie et rotation à surveiller (TTL 8 h).

## Alternatives considérées

### Option 1 : Cognito Hosted UI / OAuth redirect (rejetée)

**Pourquoi rejeté** : impose des URL de callback/logout à maintenir par environnement Vercel, pour un
gain nul au J1 (utilisateurs déjà provisionnés).

### Option 2 : Login direct + cookie HTTP-only serveur ✅ (choisie)

**Pourquoi choisi** : le plus simple qui garde le token côté serveur et satisfait l'invariant « aucun
secret exposé au navigateur ».

## Références

- Data-flow : [../data-flows/direct-cognito-auth.md](../data-flows/direct-cognito-auth.md)
- Code : `src/auth/cognito.ts`, `src/auth/session.ts`, `app/api/auth/session/route.ts`
- [../../DECISIONS-J1.md](../../DECISIONS-J1.md) §D2

---

**Statut** : Accepté
**Date** : 2026-07-21
**Décideur** : Team KYCLY
