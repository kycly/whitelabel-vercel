# Contrat — GET /api/kyc/sessions

Ce document fige le contrat de la route `GET /api/kyc/sessions` dans `whitelabel-vercel`.

Le but est simple: permettre a un utilisateur identifie de lister ses verifications demo sans introduire de persistance locale dediee dans l'app.

## Source canonique

La source canonique reste `partner-node` sandbox via `GET /kyclink/sessions`.

`whitelabel-vercel` ne fait qu'un proxy serveur borne au `demo_account_id` courant.

Consequences:

- pas de base locale dediee dans `whitelabel-vercel`
- pas de liste cross-environnement
- pas de liste cross-compte demo
- pas d'exposition des champs techniques inutiles a l'utilisateur final

## Regles d'acces

La route future devra:

1. verifier la session applicative
2. verifier `canAccess = true`
3. verifier la presence de `demo_account_id`
4. reutiliser l'id token Cognito conserve dans la session HTTP-only serveur
5. appeler `partner-node sandbox /kyclink/sessions`

Si l'un de ces prealables echoue, la route ne doit jamais tenter de fallback vers un autre compte ou un autre environnement.

## Requete cible

```http
GET /api/kyc/sessions?limit=20&offset=0&status=completed&decisionStatus=APPROVED
```

### Query params

| Champ | Type | Defaut | Regle |
|---|---|---|---|
| `limit` | `number` | `20` | entier positif, max `50` |
| `offset` | `number` | `0` | entier >= `0` |
| `status` | `string` | — | optionnel, filtre borne aux valeurs UI utiles `pending`, `processing`, `completed` |
| `decisionStatus` | `string` | — | optionnel, filtre borne a `APPROVED`, `REJECTED`, `REVIEW` |

Choix volontaires:

- `limit` est plus strict que le max backend actuel pour garder une pagination simple cote whitelabel
- aucun tri client expose: l'ordre canonique reste `created_at DESC`
- aucun filtre par date, `externalId` ou texte libre au premier jet
- les filtres `status` et `decisionStatus` sont appliques cote API whitelabel avant pagination finale

## Reponse cible

### HTTP 200

```json
{
  "data": [
    {
      "sessionId": "sess_abc123",
      "externalId": "client-order-12345",
      "status": "completed",
      "completed": true,
      "completedAt": "2026-04-08T10:05:00Z",
      "expiresAt": "2026-04-08T14:00:00Z",
      "createdAt": "2026-04-08T10:00:00Z",
      "validationStatus": "APPROVED"
    }
  ],
  "meta": {
    "returned": 1,
    "limit": 20,
    "offset": 0,
    "total": 1,
    "statusCounts": {
      "all": 1,
      "pending": 0,
      "processing": 0,
      "completed": 1
    },
    "decisionCounts": {
      "all": 1,
      "APPROVED": 1,
      "REJECTED": 0,
      "REVIEW": 0
    }
  }
}
```

### Champ par champ

| Champ | Type | Source | Note |
|---|---|---|---|
| `sessionId` | `string` | `session_id` | identifiant technique de session |
| `externalId` | `string \| null` | `external_id` | identifiant metier derive lors de la creation |
| `status` | `string` | `status` | projection brute du statut de session connu localement par `partner-node` |
| `completed` | `boolean` | derive | `true` si `completed_at` est present ou si `status = completed` |
| `completedAt` | `string \| null` | `completed_at` | horodatage de completion connu localement |
| `expiresAt` | `string \| null` | `expires_at` | expiration de l'URL KycLink |
| `createdAt` | `string` | `created_at` | ordre de tri canonique |
| `validationStatus` | `"APPROVED" \| "REJECTED" \| "REVIEW" \| null` | enrichissement par lecture detaillee | lu via `GET /kyclink/:sessionId/result` quand la session est terminee |

### Meta

| Champ | Type | Note |
|---|---|---|
| `returned` | `number` | nombre d'elements renvoyes dans la page courante |
| `limit` | `number` | limite appliquee |
| `offset` | `number` | offset applique |
| `total` | `number` | nombre total d'elements apres filtres API et avant pagination |
| `statusCounts` | `object` | compteurs utilises par les chips de filtre statut |
| `decisionCounts` | `object` | compteurs utilises par les chips de filtre decision |

Choix volontaires:

- pas de `hasMore`
- pas de `nextOffset`

Les compteurs sont calcules par `whitelabel-vercel` sur sa projection derivee:

- `statusCounts` respecte le filtre `decisionStatus` courant
- `decisionCounts` respecte le filtre `status` courant

## Projection volontairement minimale

La route whitelabel ne doit pas exposer ces champs backend:

- `id`
- `demo_account_id`
- `kyclink_url`
- `webhook_payload`
- `metadata`
- `updated_at`

Raison:

- ils ne sont pas necessaires a un ecran utilisateur `Mes verifications`
- ils augmentent le couplage au stockage local de `partner-node`
- certains sont techniques, internes ou trop bavards pour un frontend whitelabel

## Limites fonctionnelles assumees

`validationStatus` n'est pas porte par `partner-node /kyclink/sessions` lui-meme.

La route whitelabel l'enrichit donc uniquement pour les sessions deja terminees via une lecture detaillee secondaire sur `GET /kyclink/:sessionId/result`.

Consequences:

- la liste reste une projection derivee, pas un miroir brut du contrat de listing de `partner-node`
- une session terminee peut encore remonter `validationStatus = null` si la decision detaillee n'est pas encore disponible

## Erreurs cibles

### 401

```json
{
  "message": "Unauthorized.",
  "code": "UNAUTHORIZED"
}
```

### 403

```json
{
  "message": "Access denied for this demo account.",
  "code": "ACCESS_DENIED"
}
```

### Upstream failure

La route devra preferer une remontee lisible des erreurs `partner-node` utiles au frontend via le couple:

- `status`
- `code`

Sans rewriter silencieusement une erreur de scope demo, de quota demo ou de configuration runtime.

## Regle de separation a ne pas casser

Cette route reste une capacite demo / sandbox-only.

Elle ne doit pas:

- utiliser de `ck_live_*`
- appeler `partner-node` production
- fusionner plusieurs `demo_account_id`
- persister localement une copie des sessions par defaut