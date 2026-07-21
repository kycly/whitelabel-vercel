---
status: accepted
date: 2026-07-21
deciders: [tech-lead]
supersedes: null
---

# ADR 003 : Pourquoi la sélection de clé `ck_demo` est côté partner-node

## Contexte

Pour créer une session KYC, une clé `ck_demo_*` doit être choisie en fonction du compte démo de
l'utilisateur. Deux emplacements possibles : une **map locale** `demo_account_id -> ck_demo_*` dans
`whitelabel-vercel`, ou une **résolution côté `partner-node`** à partir de l'identité de l'utilisateur.

## Décision

`whitelabel-vercel` **ne maintient aucune map locale** de clés. Il présente le **JWT Cognito** en
`Authorization: Bearer` à `partner-node /kyclink/create` ; `partner-node` résout le `demo_account` et
sélectionne la clé `ck_demo_*` appropriée. Ce choix a été acté au refacto « direct cognito flow » (#2).

## Conséquences

### ✅ Positives

- Aucune clé (même démo) n'est stockée ou manipulée dans l'app whitelabel.
- La logique de mapping vit à un seul endroit (partner-node), source canonique.
- Réduit la surface de secrets côté Vercel.

### ❌ Négatives (acceptées)

- Dépendance de service forte à `partner-node` pour toute création de session.
- Le mapping `demo_account → ck_demo_*` doit exister côté partner-node sandbox pour les comptes de démo.

## Alternatives considérées

### Option 1 : Map locale `DEMO_ACCOUNT_KEY_MAP` dans whitelabel (rejetée)

Variante initiale du scaffold. **Pourquoi rejeté** : force l'app à détenir des clés, multiplie les
secrets Vercel et duplique une logique qui appartient à partner-node. La variable `DEMO_ACCOUNT_KEY_MAP`
a été retirée du code au #2 (voir la note de retrait dans
[../../runbooks/env-vars-lifecycle.md](../../runbooks/env-vars-lifecycle.md)).

### Option 2 : Résolution côté partner-node via JWT ✅ (choisie)

**Pourquoi choisi** : garde whitelabel sans clé et concentre le mapping dans le service canonique.

## Références

- Data-flow : [../data-flows/kyc-session-create.md](../data-flows/kyc-session-create.md)
- Code : `src/server/kyclink.ts` (`createKycSession`, `Authorization: Bearer` seul)
- [../../BLUEPRINT.md](../../BLUEPRINT.md) (« aucune map locale »), [../../DECISIONS-J1.md](../../DECISIONS-J1.md) §D1bis

---

**Statut** : Accepté
**Date** : 2026-07-21
**Décideur** : Team KYCLY
