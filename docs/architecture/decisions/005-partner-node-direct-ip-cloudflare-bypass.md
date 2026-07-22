---
status: accepted
date: 2026-07-21
deciders: [tech-lead]
supersedes: null
---

# ADR 005 : `KYCLY_BASE_URL` pointe sur l'IP publique directe de partner-node (contournement Cloudflare)

## Contexte

`partner-node` est protégé par Cloudflare. Les requêtes **serveur-à-serveur** provenant de Vercel (et
plus largement des ASN d'hébergeurs comme AWS) sont **bloquées** par Cloudflare avant d'atteindre
l'origine.

Symptôme observé en production : le login Cognito réussissait (`POST /api/auth/session` → 200), puis
l'utilisateur était renvoyé sur `ACCESS_DENIED`. Cause : le **premier** appel partner-node après login,
`GET /demo/me` (`src/auth/cognito.ts`), était bloqué par Cloudflare → réponse non exploitable →
`canAccess=false` (le code exige `demo_account.id` pour accorder l'accès).

La piste **service token Cloudflare Access** (en-têtes `CF-Access-Client-Id` / `CF-Access-Client-Secret`,
cf. [../data-flows/kyc-session-create.md](../data-flows/kyc-session-create.md) et
[../../runbooks/env-vars-lifecycle.md](../../runbooks/env-vars-lifecycle.md)) n'a **pas suffi** à
débloquer les appels dans cet environnement.

## Décision

`KYCLY_BASE_URL` (Vercel `Preview` et `Production`) pointe vers l'**IP publique directe de partner-node**,
**en contournant Cloudflare**. Les appels serveur (`/demo/me`, `/kyclink/*`) atteignent ainsi l'origine
directement, sans passer par le proxy Cloudflare qui les bloquait.

## Conséquences

### ✅ Positives

- Le parcours fonctionne de bout en bout : `/demo/me` répond, `canAccess` est résolu, l'utilisateur
  accède à l'app.
- Solution immédiate, sans dépendre d'un réglage Cloudflare Access/WAF plus fin.

### ❌ Négatives (acceptées, à surveiller)

- **Perte des protections Cloudflare** pour ces appels (WAF, mitigation DDoS, bot management,
  terminaison TLS au bord).
- **Exposition de l'IP d'origine** de partner-node (contredit en partie l'intérêt de Cloudflare qui
  masque l'origine).
- **TLS** : un certificat émis pour le hostname ne correspond pas à une IP — vérifier que l'appel
  `https://<ip>` valide bien la chaîne TLS (sinon TLS cassé ou vérification contournée). À contrôler.
- **Fragilité** : si l'IP d'origine change, `KYCLY_BASE_URL` doit être mise à jour manuellement.
- Solution considérée comme **interim** (voir Statut).

## Alternatives considérées

### Option 1 : Service token Cloudflare Access (tentée, insuffisante ici)

Envoyer `CF-Access-Client-Id` / `CF-Access-Client-Secret` sur les appels serveur. **Pourquoi écartée
pour l'instant** : n'a pas débloqué les appels (notamment `/demo/me`) dans cet environnement. Le code
d'envoi des en-têtes est **conservé** (`src/config/partner-access.ts`) pour un retour futur au hostname.

### Option 2 : IP publique directe, contournement Cloudflare ✅ (choisie)

**Pourquoi choisie** : débloque immédiatement le parcours, en attendant un réglage Cloudflare correct.

## Suivi recommandé

- Objectif cible : **rétablir l'accès via le hostname Cloudflare** une fois la policy Access (Service
  Auth) / la règle WAF Skip correctement configurée pour autoriser Vercel sur **tous** les chemins
  requis (`/demo/me`, `/kyclink/*`), puis repointer `KYCLY_BASE_URL` sur le hostname et retirer le
  contournement IP.
- Tant que le contournement est actif, les variables `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`
  sont **sans effet** (aucun Cloudflare dans le chemin) mais restent en place pour le retour au hostname.

## Références

- Code : `src/auth/cognito.ts` (`resolvePartnerDemoAccess`, `/demo/me`), `src/config/partner-access.ts`
- Runbook : [../../runbooks/env-vars-lifecycle.md](../../runbooks/env-vars-lifecycle.md) (`KYCLY_BASE_URL`, service token CF)
- ADR liés : [004-vercel-git-integration-deploy.md](004-vercel-git-integration-deploy.md)

---

**Statut** : Accepté (interim)
**Date** : 2026-07-21
**Décideur** : Team KYCLY
