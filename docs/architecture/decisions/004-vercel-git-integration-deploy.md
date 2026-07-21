---
status: accepted
date: 2026-07-21
deciders: [tech-lead]
supersedes: null
---

# ADR 004 : Pourquoi le déploiement Vercel Git Integration

## Contexte

`whitelabel-vercel` est une application Next.js qui doit être déployée avec des stades `Preview` et
`Production` distincts, une quality gate obligatoire, et une séparation nette entre intégration continue
et publication.

## Décision

Le déploiement est porté par la **Git Integration native de Vercel** (pas de déploiement depuis GitHub
Actions). GitHub Actions joue le rôle de **quality gate bloquant** (`.github/workflows/ci.yml`). Stratégie
de branches : `main` = intégration (Preview automatique), `production` = publication (Production
automatique). Aucune bascule métier automatique vers `partner-node production`.

## Conséquences

### ✅ Positives

- Build Next.js optimisé géré nativement par Vercel.
- Preview automatique sur PR/branches ; Production intentionnelle via promotion vers `production`.
- CI et publication clairement séparées.

### ❌ Négatives (acceptées)

- La divergence d'historique `main`/`production` doit être gérée à chaque promotion (risque de conflit
  `package.json`/lockfile lors des merges de promotion).
- Deux ensembles de variables d'environnement à tenir cohérents (Preview / Production).

## Alternatives considérées

### Option 1 : Déploiement piloté par GitHub Actions (rejetée)

**Pourquoi rejeté** : réimplémente ce que Vercel fait nativement, sans bénéfice pour une app Next.js.

### Option 2 : Vercel Git Integration + quality gate Actions ✅ (choisie)

**Pourquoi choisi** : sépare proprement gate (GitHub) et déploiement (Vercel), aligné sur le runbook cible.

## Références

- Runbook : [../../runbooks/cicd-workflow.md](../../runbooks/cicd-workflow.md)
- Runbook : [../../runbooks/repository-governance-setup.md](../../runbooks/repository-governance-setup.md)

---

**Statut** : Accepté
**Date** : 2026-07-21
**Décideur** : Team KYCLY
