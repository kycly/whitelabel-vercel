# Contrat — GET /api/kyc/session/:sessionId

Ce document fige le contrat de la route `GET /api/kyc/session/:sessionId` dans `whitelabel-vercel`.

Le but est simple: relire une session KYC existante de maniere canonique avant d'ouvrir l'iframe, afin de couvrir le refresh et la reprise depuis l'historique sans dependre d'un stockage navigateur.

## Source canonique

La source canonique reste `partner-node` sandbox via `GET /kyclink/:sessionId`.

`whitelabel-vercel` ne persiste pas localement une copie durable de cette session. La route ne fait qu'un proxy serveur scope au `demo_account_id` courant.

Consequences:

- pas de source de verite en `sessionStorage`
- pas de reprise cross-compte demo
- pas de fallback silencieux vers une autre session
- la decision finale de reprise est toujours prise cote serveur avant affichage de KycLink

## Regles d'acces

La route actuelle doit:

1. verifier la session applicative
2. verifier `canAccess = true`
3. verifier la presence de `demo_account_id`
4. reutiliser l'id token Cognito conserve dans la session HTTP-only serveur
5. appeler `partner-node sandbox /kyclink/:sessionId`

Si l'un de ces prealables echoue, la route ne doit jamais tenter de fallback vers un autre compte ou un autre environnement.

## Requete cible

```http
GET /api/kyc/session/sess_abc123
```

## Reponse cible

### HTTP 200

```json
{
  "sessionId": "sess_abc123",
  "externalId": "client-order-12345",
  "kyclinkUrl": "https://kyclink.kycly.io/v/abc123",
  "status": "processing",
  "expiresAt": "2026-04-08T14:00:00Z",
  "completedAt": null,
  "workflowStatus": "IN_REVIEW",
  "sessionState": "ACTIVE",
  "resumeAvailable": true
}
```

### Champ par champ

| Champ | Type | Source | Note |
|---|---|---|---|
| `sessionId` | `string` | `sessionId` | identifiant technique de session |
| `externalId` | `string \| null` | `externalId` | identifiant metier derive lors de la creation |
| `kyclinkUrl` | `string` | `kyclinkUrl` | URL iframe canonique stockee cote `partner-node` |
| `status` | `"pending" \| "processing" \| "completed"` | `status` | projection du statut technique de session |
| `expiresAt` | `string \| null` | `expiresAt` | expiration de l'URL KycLink |
| `completedAt` | `string \| null` | `completedAt` | horodatage de completion connu |
| `workflowStatus` | `"PENDING" \| "IN_REVIEW" \| "ESCALATED" \| "APPROVED" \| "REJECTED" \| null` | `workflowStatus` | projection du statut metier courant |
| `sessionState` | `"ACTIVE" \| "COMPLETED" \| "EXPIRED"` | derive de `partner-node` | verdict de reprise canonique |
| `resumeAvailable` | `boolean` | derive de `partner-node` | `true` uniquement si `sessionState = ACTIVE` |

## Regles de pilotage UI

Cette route pilote l'entree `/verify/session?sessionId=...` avec les regles suivantes:

1. `ACTIVE` + `resumeAvailable = true` -> afficher KycLink
2. `COMPLETED` -> rediriger vers `/complete?sessionId=...`
3. `EXPIRED` -> rediriger vers `/failure` avec code `SESSION_EXPIRED`
4. `404 KYCLINK_SESSION_NOT_FOUND` -> rediriger vers `/failure` avec code `SESSION_NOT_FOUND`
5. erreur upstream non qualifiee -> rediriger vers `/failure` avec code `SESSION_FETCH_FAILED`

## Politique d'erreur protegee commune

Le frontend ne reinterprete plus cette route ecran par ecran.

Decision commune retenue pour les routes protegees:

1. `401` ou `UNAUTHORIZED` -> la route renvoie une erreur structuree, efface la session applicative locale si l'echec vient de l'upstream, puis le client declenche le logout centralise
2. `403 ACCESS_DENIED` -> le client redirige vers `/access-denied`
3. `404 KYCLINK_SESSION_NOT_FOUND` -> le client redirige vers `/failure` avec le code canonique `SESSION_NOT_FOUND`
4. autre erreur qualifiee -> le client redirige vers `/failure` avec le code canonique `SESSION_FETCH_FAILED`

## Erreurs cibles

### 401

```json
{
  "message": "Unauthorized.",
  "code": "UNAUTHORIZED"
}
```

Comportement attendu:

- pas de banner inline sur l'ecran `/verify/session`
- effacement du cookie de session locale si `partner-node` rejette le JWT Cognito en upstream
- repli vers le flux de logout client commun

### 403

```json
{
  "message": "Access denied for this demo account.",
  "code": "ACCESS_DENIED"
}
```

### 404

```json
{
  "message": "KycLink session not found",
  "code": "KYCLINK_SESSION_NOT_FOUND"
}
```

### Upstream failure

La route doit preferer une remontee lisible des erreurs `partner-node` utiles au frontend via le couple:

- `status`
- `code`

Sans fallback implicite vers `GET /api/kyc/sessions` ni transformation silencieuse en session vide.

Le frontend applique ensuite la meme politique protegee que pour `POST /api/kyc/session`, `GET /api/kyc/session/:sessionId/result` et `GET /api/kyc/sessions`.

## Regle de separation a ne pas casser

Cette route reste une capacite demo / sandbox-only.

Elle ne doit pas:

- utiliser de `ck_live_*`
- appeler `partner-node` production
- fusionner plusieurs `demo_account_id`
- reconstruire `kyclinkUrl` depuis une source locale navigateur