# Contrat — GET /api/kyc/sessions

Ce document fige le contrat de la route `GET /api/kyc/sessions` dans `whitelabel-vercel`.

Le but est simple: permettre a un utilisateur identifie de lister ses verifications demo sans introduire de persistance locale dediee dans l'app.

Cette liste sert aussi de point d'entree pour reprendre une session KYC incomplete encore valide.

## Source canonique

La source canonique reste `partner-node` sandbox via `GET /kyclink/sessions`.

`whitelabel-vercel` cible cette lecture via `KYCLY_SESSION_BASE_URL`. Si la variable est vide, le proxy replie sur `KYCLY_API_BASE_URL`.

`whitelabel-vercel` ne fait qu'un proxy serveur borne au `demo_account_id` courant.

Consequences:

- pas de base locale dediee dans `whitelabel-vercel`
- pas de liste cross-environnement
- quand `workflowStatus = null`, le rendu UI attendu cote whitelabel est le libelle `TRAIT. EN COURS`
- pas de liste cross-compte demo
- pas d'exposition des champs techniques inutiles a l'utilisateur final

La reprise effective ne se fait pas directement depuis cette reponse. L'UI utilise `sessionId`, puis relit la session canonique via `GET /api/kyc/session/:sessionId` avant d'ouvrir KycLink.

Regles UI mobile-first associees:

- les 3 cartes metriques de synthese restent sur une meme ligne
- la page reste une seule colonne de lecture, y compris sur desktop ou elle doit seulement paraitre plus aeree
- le corps de page defile dans une zone interne dediee, sans scroll parasite du document
- les actions rapides `Actualiser` et `Nouvelle verification` conservent un format compact de 44px de hauteur

## Regles d'acces

La route actuelle doit:

1. verifier la session applicative
2. verifier `canAccess = true`
3. verifier la presence de `demo_account_id`
4. reutiliser l'id token Cognito conserve dans la session HTTP-only serveur
5. appeler `partner-node sandbox /kyclink/sessions`

Si l'un de ces prealables echoue, la route ne doit jamais tenter de fallback vers un autre compte ou un autre environnement.

## Requete cible

```http
GET /api/kyc/sessions?limit=20&offset=0&status=completed&workflowStatus=APPROVED
```

### Query params

| Champ | Type | Defaut | Regle |
|---|---|---|---|
| `limit` | `number` | `20` | entier positif, max `50` |
| `offset` | `number` | `0` | entier >= `0` |
| `status` | `string` | — | optionnel, filtre borne aux valeurs UI utiles `pending`, `processing`, `completed` |
| `workflowStatus` | `string` | — | optionnel, filtre borne a `PENDING`, `IN_REVIEW`, `ESCALATED`, `APPROVED`, `REJECTED` |

Choix volontaires:

- `limit` est plus strict que le max backend actuel pour garder une pagination simple cote whitelabel
- aucun tri client expose: l'ordre canonique reste `created_at DESC`
- aucun filtre par date, `externalId` ou texte libre au premier jet
- les filtres `status` et `workflowStatus` sont appliques cote API whitelabel avant pagination finale

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
      "workflowStatus": "APPROVED"
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
    "workflowCounts": {
      "all": 1,
      "PENDING": 0,
      "IN_REVIEW": 0,
      "ESCALATED": 0,
      "APPROVED": 1,
      "REJECTED": 0
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
| `workflowStatus` | `"PENDING" \| "IN_REVIEW" \| "ESCALATED" \| "APPROVED" \| "REJECTED" \| null` | `workflow_status` | projection brute du statut metier local issu de `partner-node verifications_local.status` |

### Meta

| Champ | Type | Note |
|---|---|---|
| `returned` | `number` | nombre d'elements renvoyes dans la page courante |
| `limit` | `number` | limite appliquee |
| `offset` | `number` | offset applique |
| `total` | `number` | nombre total d'elements apres filtres API et avant pagination |
| `statusCounts` | `object` | compteurs utilises par les chips de filtre statut |
| `workflowCounts` | `object` | compteurs utilises par les chips de filtre statut metier |

Choix volontaires:

- pas de `hasMore`
- pas de `nextOffset`

Les compteurs sont calcules par `whitelabel-vercel` sur sa projection derivee:

- `statusCounts` respecte le filtre `workflowStatus` courant
- `workflowCounts` respecte le filtre `status` courant

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

`workflowStatus` est porte directement par `partner-node /kyclink/sessions` sous le nom `workflow_status`.

La route whitelabel ne synthétise plus de statut metier et ne derive plus de decision depuis une lecture detaillee secondaire.

Consequences:

- la liste reste une projection minimale, mais le statut metier affiche est un miroir direct de `partner-node`
- une session peut encore remonter `workflowStatus = null` tant qu'aucune verification locale n'est encore rattachee a ce `session_id`

## Regle de reprise UI

L'ecran `Mes verifications` applique la regle suivante:

1. afficher `Reprendre` si `completed = false`
2. exiger `expiresAt` non nul
3. exiger `expiresAt > now`
4. pointer vers `/verify/session?sessionId=...`

Regle de navigation associee:

- le retour de `Mes verifications` renvoie explicitement vers `WELCOME`
- cette navigation ne depend pas de l'historique navigateur

Le verdict final de reprise reste toutefois porte par `GET /api/kyc/session/:sessionId`, afin d'eviter toute dependance a l'etat local du navigateur.

## Politique d'erreur protegee commune

La liste `Mes verifications` ne gere plus separement le logout ni les redirections d'erreur.

Decision commune retenue:

1. `401` ou `UNAUTHORIZED` -> effacement du cookie de session locale si l'upstream rejette le JWT Cognito, puis logout client centralise
2. `403 ACCESS_DENIED` -> redirection vers `/access-denied`
3. indisponibilite de lecture qualifiee -> redirection vers `/failure` avec le code canonique `SESSIONS_FETCH_FAILED`

Cette meme politique s'applique aussi aux autres ecrans KYC proteges (`SESSION_PREPARE`, `SESSION_GATE`, `COMPLETE`).

## Erreurs cibles

### 401

```json
{
  "message": "Unauthorized.",
  "code": "UNAUTHORIZED"
}
```

Comportement attendu:

- pas de persistance sur l'ecran `Mes verifications` avec un simple message inline quand la session Cognito a expire
- effacement du cookie de session locale si le rejet vient de `partner-node`
- repli vers le flux de logout commun

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

Le frontend applique ensuite le mapping protege commun plutot qu'une logique locale specifique a la page.

## Regle de separation a ne pas casser

Cette route reste une capacite demo / sandbox-only.

Elle ne doit pas:

- utiliser de `ck_live_*`
- appeler `partner-node` production
- fusionner plusieurs `demo_account_id`
- persister localement une copie des sessions par defaut