---
status: accepted
date: 2026-07-21
deciders: [tech-lead]
supersedes: null
---

# ADR 002 : Pourquoi sandbox-only et `ck_demo_*` uniquement

## Contexte

`whitelabel-vercel` est une application **démo**. Même déployée sur des environnements Vercel `Preview`
et `Production`, sa portée métier doit rester cantonnée au runtime **sandbox** de `partner-node`, sans
jamais toucher de données ou de clés de production.

## Décision

L'application est **sandbox-only** au J1 : elle n'utilise que des clés `ck_demo_*` et cible exclusivement
`partner-node sandbox`, quel que soit le stade de déploiement Vercel. L'introduction de `ck_live_*` est
**interdite** et bloquée par un garde-fou automatisé (`scripts/check-sandbox-only.mjs`, câblé en CI et
pre-push).

## Conséquences

### ✅ Positives

- Aucun risque d'atteindre des données de production depuis une démo.
- `Preview` et `Production` Vercel = stades de déploiement de l'app, pas des cibles métier distinctes.
- Le garde-fou rend la violation détectable mécaniquement.

### ❌ Négatives (acceptées)

- Un futur mode « prod réelle » nécessitera une décision explicite (nouvel ADR) modifiant le blueprint.

## Alternatives considérées

### Option 1 : Autoriser `ck_live_*` en Production Vercel (rejetée)

**Pourquoi rejeté** : confond le stade de déploiement Vercel avec la cible métier ; ouvre un risque de
fuite de données réelles depuis une application de démonstration.

### Option 2 : Sandbox-only verrouillé par garde-fou ✅ (choisie)

**Pourquoi choisi** : aligne la portée métier sur l'usage réel (démo) et la rend inviolable par CI.

## Références

- `scripts/check-sandbox-only.mjs`, `.github/workflows/ci.yml` (étape `guard:sandbox-only`)
- [../../DECISIONS-J1.md](../../DECISIONS-J1.md) §D1bis, [../../BLUEPRINT.md](../../BLUEPRINT.md)

---

**Statut** : Accepté
**Date** : 2026-07-21
**Décideur** : Team KYCLY
