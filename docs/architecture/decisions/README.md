# Architecture Decision Records (ADRs) — whitelabel-vercel

**Statut** : Index des ADRs — référence architecture.
**Audience** : Architectes, développeurs.
**Lire d'abord** : [../README.md](../README.md), [../../BLUEPRINT.md](../../BLUEPRINT.md).

Ce répertoire contient les décisions architecturales majeures de `whitelabel-vercel`. Les
arbitrages de démarrage restent consignés dans [../../DECISIONS-J1.md](../../DECISIONS-J1.md),
que ces ADR formalisent et prolongent.

## Liste des ADRs

| # | Titre | Statut | Date | Décideur |
|---|-------|--------|------|----------|
| [001](001-direct-cognito-auth-flow.md) | Pourquoi le flux Cognito direct | ✅ Accepté | 2026-07-21 | Team KYCLY |
| [002](002-sandbox-only-ck-demo.md) | Pourquoi sandbox-only et `ck_demo_*` uniquement | ✅ Accepté | 2026-07-21 | Team KYCLY |
| [003](003-ck-demo-selection-partner-node.md) | Pourquoi la sélection de clé `ck_demo` est côté partner-node | ✅ Accepté | 2026-07-21 | Team KYCLY |
| [004](004-vercel-git-integration-deploy.md) | Pourquoi le déploiement Vercel Git Integration | ✅ Accepté | 2026-07-21 | Team KYCLY |
| [005](005-partner-node-direct-ip-cloudflare-bypass.md) | `KYCLY_BASE_URL` sur l'IP directe (contournement Cloudflare) | ✅ Accepté (interim) | 2026-07-21 | Team KYCLY |

## Template

Voir [TEMPLATE.md](TEMPLATE.md) pour créer un nouvel ADR.

## Statuts

- ✅ **Accepté** — décision validée et implémentée
- 📝 **Proposé** — en cours de discussion
- ⚠️ **Déprécié** — remplacé par une décision plus récente
