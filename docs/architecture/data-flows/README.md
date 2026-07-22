# Data-flows — whitelabel-vercel

**Statut** : Index des flux de données vérifiés.
**Audience** : Développeurs backend/frontend, architectes.

| Flux | Objet | Code source |
|---|---|---|
| [direct-cognito-auth.md](direct-cognito-auth.md) | Authentification Cognito directe → cookie HTTP-only | `src/auth/*`, `app/api/auth/session` |
| [kyc-session-create.md](kyc-session-create.md) | Création de session KYC + lecture résultat | `src/server/kyclink.ts`, `app/api/kyc/*` |
| [verification-detail.md](verification-detail.md) | Écran détail (OCR + images), `/sessions/:sessionId` | `src/server/kyclink.ts`, `app/api/kyc/session/*/detail`, `app/api/kyc/session/*/images/*`, `src/components/verify/verification-detail.tsx` |

Ces documents sont **vérifiés contre le code** ; toute évolution des surfaces citées doit les mettre à jour
(garde-fou `check-doc-drift`, cf. [../../runbooks/cicd-workflow.md](../../runbooks/cicd-workflow.md)).
