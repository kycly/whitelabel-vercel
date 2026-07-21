# Guide d'integration React — `@kycly/link`

> **Scope** : integration de `whitelabel-vercel` avec KycLink via `partner-node`.
> Ce guide couvre uniquement le chemin utile pour creer une session KYC puis embarquer l'iframe KycLink dans une application React.
> Pour whitelabel-vercel au J1, `partner-node` sandbox est le service KYC canonique appele cote serveur.
> Ce guide est volontairement borne au mode demo / sandbox-only de cette app: `ck_live_*` et l'integration production generique sont hors scope ici.

---

## 1. Objectif

Le flux cible est le suivant:

1. votre **backend applicatif** appelle `partner-node`
2. `partner-node` cree une session KycLink
3. votre backend recoit `{ sessionId, kyclinkUrl, expiresAt }`
4. votre frontend React relit la session canonique sur `/verify/session?sessionId=...`
5. votre frontend React rend `<KycLink />` si la session est encore reprenable

```text
Frontend React
  -> appelle votre backend applicatif

Backend applicatif
  -> POST https://api.kycly.sn/kyclink/create
  -> Authorization: Bearer <cognito-id-token>
  -> recoit { sessionId, kyclinkUrl, expiresAt }

Frontend React
  -> relit GET /api/kyc/session/:sessionId
  -> rend <KycLink kyclinkUrl={...} /> si la session est ACTIVE
```

**Regle centrale** : n'appelez pas `partner-node` directement depuis le navigateur. La creation de session se fait cote serveur, jamais cote frontend.

Pour `whitelabel-vercel`, la reprise et le refresh ne doivent plus dependre d'un stockage navigateur comme source de verite. L'entree `/verify/session?sessionId=...` relit toujours `GET /api/kyc/session/:sessionId`, puis:

- ouvre KycLink si la session est `ACTIVE`
- redirige vers `COMPLETE` si la session est `COMPLETED`
- redirige vers `FAILURE` si la session est `EXPIRED` ou introuvable
- ne depend jamais d'une session KYC active prealablement sauvegardee en `sessionStorage`

Regle UI mobile-first associee:

- `SESSION_PREPARE` et `SESSION_GATE` restent des etats transitoires courts, centres et sobres
- l'ecran `KYC_LINK` maximise la hauteur utile de l'iframe
- le viewport du shell reste verrouille pour eviter tout scroll du document concurrent au parcours embarque
- aucun padding ou chrome concurrent ne doit reduire artificiellement l'espace du parcours embarque

---

## 2. Prerequis

### 2.1 — Installer le package prive

Le SDK frontend est publie sous le nom `@kycly/link` sur GitHub Packages.

Pattern retenu pour `whitelabel-vercel`:

- consommation depuis le registre GitHub Packages
- pas de consommation via `infrastructure-node`
- pas de dependance `workspace:*`, `file:` ou copie locale du package

Ajouter a la racine du projet frontend exactement ce fichier `.npmrc`:

```ini
@kycly:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Ce format est le plus robuste ici parce que:

- le depot ne committe aucun secret
- `pnpm add @kycly/link` fonctionne en local des que `NODE_AUTH_TOKEN` est exporte
- le meme `.npmrc` fonctionne aussi en CI via injection de `NODE_AUTH_TOKEN`

Le token ne doit jamais etre committe en clair dans le depot.

Authentification locale recommandee:

```bash
gh auth status
export NODE_AUTH_TOKEN="$(gh auth token)"
npm whoami --registry https://npm.pkg.github.com
pnpm add @kycly/link
```

Si `npm whoami` ou `pnpm add` echoue, la cause la plus probable est un token sans droits packages suffisants. Dans ce cas, utiliser un token GitHub ayant au minimum:

- `read:packages`
- acces au depot qui publie `@kycly/link`

Puis re-exporter:

```bash
export NODE_AUTH_TOKEN="<votre_token_packages>"
pnpm add @kycly/link
```

Alternative persistante pour une machine locale: stocker le token dans `~/.npmrc` plutot que dans le depot.

```ini
@kycly:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=<github_packages_token>
```

Dans ce cas, le `.npmrc` du repo peut rester tel quel et vous n'avez plus besoin d'exporter `NODE_AUTH_TOKEN` a chaque shell.

Pattern CI recommande:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: "22"
    cache: pnpm
    registry-url: https://npm.pkg.github.com

- name: Install dependencies
  run: pnpm install --frozen-lockfile
  env:
    NODE_AUTH_TOKEN: ${{ secrets.GH_PACKAGES_TOKEN }}
```

Installation:

```bash
pnpm add @kycly/link
```

Contraintes utiles:

| Element | Valeur |
|---|---|
| Format | ESM uniquement |
| React | `^18` ou `^19` |
| react-dom | `^18` ou `^19` |
| TypeScript | declarations `.d.ts` incluses |

### 2.2 — Instance backend actuelle

Pour cette app, `KYCLY_BASE_URL` doit toujours pointer vers le runtime sandbox de `partner-node` pour `POST /kyclink/create` et `GET /kyclink/:sessionId/result`.

La lecture de liste `GET /kyclink/sessions` utilise le meme `KYCLY_BASE_URL` (hote unique partner-node).

La resolution du scope demo via `/demo/me` utilise le meme `KYCLY_BASE_URL`.

Si vous voulez figer strictement l'origine parent transmise a KycLink, configurez aussi `APP_CANONICAL_ORIGIN`. Sinon, `whitelabel-vercel` derive `parentOrigin` cote serveur depuis `x-forwarded-host` / `x-forwarded-proto`, puis `host`. Le header navigateur `Origin` n'est plus la source de verite.

Pour l'usage interne actuel, l'instance de reference est:

```text
https://api.kycly.sn
```

La route d'integration a utiliser est:

```text
POST https://api.kycly.sn/kyclink/create
```

### 2.3 — Credential serveur a utiliser

Dans `whitelabel-vercel`, l'appel serveur vers `partner-node sandbox` reutilise l'id token Cognito du compte connecte.

Cas retenu:

| Environnement | Token | Usage |
|---|---|---|
| sandbox | id token Cognito | authentification serveur-a-serveur scopee par `partner-node` |

Contraintes importantes:

- le token reste cote serveur uniquement, dans la session HTTP-only signee
- `partner-node` verifie le JWT puis resout dynamiquement le scope demo a partir du `sub`
- aucune map locale `demo_account_id -> ck_demo_*` n'est maintenue dans `whitelabel-vercel`

---

## 3. Appeler `partner-node` depuis votre backend

### 3.1 — Contrat de la route

```http
POST /kyclink/create
Authorization: Bearer <cognito-id-token>
Content-Type: application/json
```

Payload attendu:

```ts
{
  externalId: string;
  parentOrigin: string;
  metadata?: SessionMetadata;
}
```

Dans whitelabel-vercel, `externalId` est saisi dans le formulaire comme un champ metier simple, ou genere a la demande via une icone discrète. Il n'est pas expose comme parametre technique brut au reste de l'UI. `parentOrigin` est resolue cote backend depuis une origine canonique configuree (`APP_CANONICAL_ORIGIN`) ou, a defaut, depuis les headers forwardes / le host de la requete, puis forwardee vers `partner-node`.

Reponse succes:

```json
{
  "sessionId": "sess_a3f9c2e1-4b5d-xxxx",
  "kyclinkUrl": "https://link.kycly.io/s/sess_a3f9c2e1-4b5d-xxxx?cs=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "expiresAt": "2026-05-17T14:00:00.000Z"
}
```

Erreurs que vous rencontrerez vraiment:

| HTTP | Code | Cause probable |
|---|---|---|
| `401` | `UNAUTHORIZED` | bearer absent ou invalide |
| `403` | `TOKEN_TYPE_NOT_ALLOWED_IN_ENV` | token non compatible avec le runtime sandbox |
| `403` | `DEMO_ACCOUNT_SCOPE_REQUIRED` | appel sandbox sans scope demo valide |
| `429` | `DEMO_QUOTA_EXCEEDED` | quota demo depasse |
| `422` | — | `externalId` ou `metadata` invalides |
| `503` | `SERVICES_UNAVAILABLE` | `client_api_key` non configuree cote `partner-node` |

### 3.2 — Exemple backend minimal

```ts
type SessionMetadata = {
  metadataVersion: 1;
  notificationContext?: {
    phone?: string;
    email?: string;
    pushToken?: string;
    preferredChannel?: "sms" | "email" | "push";
  };
  businessContext?: Record<string, string | number | boolean>;
  routingContext?: Record<string, string | number | boolean>;
  complianceContext?: Record<string, string | number | boolean>;
  customContext?: Record<string, string | number | boolean>;
};

type CreateKycLinkSessionRequest = {
  externalId: string;
  metadata?: SessionMetadata;
};

type CreateKycLinkSessionResponse = {
  sessionId: string;
  kyclinkUrl: string;
  expiresAt: string;
};

export async function createKycLinkSession(
  input: CreateKycLinkSessionRequest,
  resolvedParentOrigin: string,
  cognitoIdToken: string,
  baseUrl = process.env.KYCLY_BASE_URL ?? "https://api.kycly.sn",
): Promise<CreateKycLinkSessionResponse> {
  const endpoint = new URL("/kyclink/create", `${baseUrl}/`).toString();
  const payload = {
    ...input,
    parentOrigin: resolvedParentOrigin,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cognitoIdToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`partner-node create failed: ${response.status}`);
  }

  return (await response.json()) as CreateKycLinkSessionResponse;
}
```

Dans `whitelabel-vercel`, cette fonction n'utilise pas une variable unique de type `KYCLY_CLIENT_API_KEY`.
Le flux retenu est le suivant:

1. verifier le JWT Cognito cote serveur
2. appeler `GET /demo/me` sur `KYCLY_BASE_URL`
3. recuperer le `demoAccountId` courant
4. conserver l'id token Cognito dans la session HTTP-only signee
5. resoudre `parentOrigin` cote serveur (origine canonique configuree, sinon headers forwardes / host)
6. appeler `POST /kyclink/create` sur `KYCLY_BASE_URL` avec ce token et cette `parentOrigin`

### 3.3 — Route a exposer dans votre propre backend

Votre frontend React ne doit pas appeler `https://api.kycly.sn/kyclink/create` directement.

Pattern recommande:

1. votre frontend appelle une route de **votre** backend, par exemple `/api/kyc/session`
2. votre backend appelle `partner-node`
3. votre backend retourne `{ sessionId, kyclinkUrl, expiresAt }`

Exemple Express minimal:

```ts
app.post("/api/kyc/session", async (req, res) => {
  const cognitoIdToken = readCognitoIdTokenFromSignedSession(req);

  const session = await createKycLinkSession({
    externalId: req.body.externalId,
    metadata: req.body.metadata,
  }, cognitoIdToken);

  res.status(201).json(session);
});
```

---

## 4. Integrer KycLink dans votre frontend React

### 4.1 — Imports utiles

```ts
import { KycLink } from "@kycly/link/react";
import type {
  KycLinkCompletePayload,
  KycLinkErrorPayload,
  KycLinkStep,
} from "@kycly/link";
```

### 4.2 — Exemple React complet

Cet exemple montre le vrai chemin d'integration:

- le frontend appelle votre backend `/api/kyc/session`
- votre backend retourne `kyclinkUrl`
- le composant React rend ensuite `<KycLink />`

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KycLink } from "@kycly/link/react";
import type {
  KycLinkCompletePayload,
  KycLinkErrorPayload,
  KycLinkStep,
} from "@kycly/link";

type KycLinkSession = {
  sessionId: string;
  kyclinkUrl: string;
  expiresAt: string;
};

const PARENT_ORIGIN_HANDSHAKE_MESSAGE_TYPE = "kyclink:parent-origin:init";

export function KycLinkPage({ userId }: { userId: string }) {
  const [session, setSession] = useState<KycLinkSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iframeContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const response = await fetch("/api/kyc/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          externalId: userId,
          metadata: {
            metadataVersion: 1,
            businessContext: {
              customerId: userId,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`session creation failed: ${response.status}`);
      }

      const data = (await response.json()) as KycLinkSession;

      if (!cancelled) {
        setSession(data);
      }
    }

    boot().catch((reason) => {
      if (!cancelled) {
        setError(reason instanceof Error ? reason.message : "Unknown error");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const kyclinkOrigin = useMemo(
    () => (session ? new URL(session.kyclinkUrl).origin : null),
    [session],
  );

  const stopHandshake = useCallback((intervalId: number | null) => {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
    }
  }, []);

  useEffect(() => {
    if (!session || !kyclinkOrigin) {
      return;
    }

    const container = iframeContainerRef.current;
    if (!container) {
      return;
    }

    const iframe = container.querySelector("iframe");
    if (!(iframe instanceof HTMLIFrameElement)) {
      return;
    }

    const message = {
      type: PARENT_ORIGIN_HANDSHAKE_MESSAGE_TYPE,
      sessionId: session.sessionId,
    };

    const sendHandshake = () => {
      iframe.contentWindow?.postMessage(message, kyclinkOrigin);
    };

    sendHandshake();
    const intervalId = window.setInterval(sendHandshake, 500);

    return () => {
      stopHandshake(intervalId);
    };
  }, [kyclinkOrigin, session, stopHandshake]);

  if (error) {
    return <p>Erreur KYC: {error}</p>;
  }

  if (!session) {
    return <p>Creation de la session KYC...</p>;
  }

  return (
    <div ref={iframeContainerRef}>
      <KycLink
        kyclinkUrl={session.kyclinkUrl}
        height="700px"
        className="kyc-iframe"
        style={{ borderRadius: "12px" }}
        onReady={() => {
          console.log("KycLink pret");
        }}
        onStep={(step: KycLinkStep) => {
          console.log("KycLink step:", step);
        }}
        onComplete={(result: KycLinkCompletePayload) => {
          console.log("Parcours termine:", result.sessionId, result.status);
        }}
        onError={(payload: KycLinkErrorPayload) => {
          console.error("KycLink error:", payload.code, payload.message);
        }}
      />
    </div>
  );
}
```

Le host React doit maintenant emettre ce handshake `kyclink:parent-origin:init` vers l'iframe. KycLink valide `event.origin` contre la `parentOrigin` stockee cote backend; `document.referrer` n'est plus la preuve de securite retenue.

### 4.3 — Ce que signifie `onComplete`

`onComplete` signifie uniquement:

- l'utilisateur a termine le parcours dans l'iframe
- le SDK vous renvoie `{ sessionId, status: "success" }`

`onComplete` **ne signifie pas** que la decision metier finale est `APPROVED` ou `REJECTED`.

Pattern J1 retenu dans `whitelabel-vercel`:

1. `onComplete` redirige vers l'ecran `COMPLETE`
2. l'ecran `COMPLETE` attend au moins 10 secondes
3. le frontend appelle ensuite `/api/kyc/session/:sessionId/result`
4. le backend applicatif appelle `partner-node /kyclink/:sessionId/result`
5. si cette route detail repond `404`, le backend replie sur `GET /kyclink/sessions` pour reconstruire un etat minimal de resultat
6. la page affiche `externalId`, `status`, `completed`, `completedAt` et `workflowStatus`
7. les polls suivants utilisent un backoff progressif jusqu'au statut final ou a la limite de tentatives

Autrement dit, `onComplete` clot le parcours iframe, puis un polling backend controle prend le relais pour recuperer la decision metier observable.

### 4.4 — Ecran detail (OCR + images), distinct de `COMPLETE`

En plus du compte a rebours `COMPLETE`, `whitelabel-vercel` expose un ecran detail
`/sessions/:sessionId` (lien "Voir le resultat" depuis la liste des sessions) qui affiche l'OCR
complet et les images capturees, pas seulement la decision. Deux routes backend supplementaires,
en scope demo (`sandbox_operator`), servent cet ecran:

- `GET /api/kyc/session/:sessionId/detail` -> proxifie `partner-node GET
  /kyclink/:sessionId/verification-detail` -> `{ ocrFront, ocrBack, faceSimilarity, imageSides }`.
- `GET /api/kyc/session/:sessionId/images/:side` -> proxifie `partner-node GET
  /kyclink/:sessionId/verification-detail/images/:side` -> image binaire (recto/verso/portrait/liveness).

Ces deux routes partner-node resolvent `sessionId -> verificationId` cote demo
(`getLocalVerificationBySessionId`), independamment de la route reviseur `/verifications/:id`.
Detail complet du flux: [data-flows/verification-detail.md](../architecture/data-flows/verification-detail.md).

---

## 5. Metadonnees de session

Le champ `metadata` est defini **au moment de la creation de session**.

### 5.1 — Structure

```ts
type SessionMetadata = {
  metadataVersion: 1;
  notificationContext?: {
    phone?: string;
    email?: string;
    pushToken?: string;
    preferredChannel?: "sms" | "email" | "push";
  };
  businessContext?: Record<string, string | number | boolean>;
  routingContext?: Record<string, string | number | boolean>;
  complianceContext?: Record<string, string | number | boolean>;
  customContext?: Record<string, string | number | boolean>;
};
```

### 5.2 — Regles a respecter

| Regle | Valeur |
|---|---|
| `metadataVersion` | obligatoire, valeur exacte `1` |
| Taille totale JSON | 8 KB max |
| Nombre de cles total | 50 max |
| Profondeur max | 2 niveaux |
| Longueur max d'une string | 512 caracteres |
| Valeurs dans les contextes generiques | `string | number | boolean` |

### 5.3 — Cles interdites

Les cles suivantes provoquent un rejet de validation:

```text
password
secret
token
apikey
api_key
authorization
bearer
private_key
privatekey
ssn
social_security
credit_card
creditcard
cvv
pin
passphrase
```

### 5.4 — Exemple utile

```json
{
  "externalId": "customer_42",
  "metadata": {
    "metadataVersion": 1,
    "notificationContext": {
      "phone": "+221771234567",
      "preferredChannel": "sms"
    },
    "businessContext": {
      "customerId": "customer_42",
      "country": "SN",
      "plan": "premium"
    },
    "routingContext": {
      "journey": "onboarding"
    }
  }
}
```

---

## 6. Surface React du package

### 6.1 — Import principal

```ts
import { KycLink } from "@kycly/link/react";
```

### 6.2 — Types utiles

```ts
export type KycLinkStep =
  | "document_select"
  | "document_scan"
  | "liveness"
  | "completed";

export interface KycLinkCompletePayload {
  sessionId: string;
  status: "success";
}

export interface KycLinkErrorPayload {
  code?: string;
  message?: string;
  error?: string;
  sessionId?: string;
}
```

### 6.3 — Props du composant `KycLink`

| Prop | Type | Requis | Defaut | Role |
|---|---|---|---|---|
| `kyclinkUrl` | `string` | oui | — | URL de session retournee par `partner-node` |
| `onReady` | `() => void` | non | — | iframe prete |
| `onStep` | `(step: KycLinkStep) => void` | non | — | suivi d'etapes |
| `onComplete` | `(result: KycLinkCompletePayload) => void` | non | — | fin du parcours UX |
| `onError` | `(error: KycLinkErrorPayload) => void` | non | — | erreur remontee par l'iframe |
| `height` | `number | string` | non | `"600px"` | hauteur de l'iframe |
| `className` | `string` | non | — | classe CSS appliquee a l'iframe |
| `style` | `CSSProperties` | non | — | styles inline appliques a l'iframe |
| `allowedOrigin` | `string` | non | derive de `kyclinkUrl` | override d'origine `postMessage` |

### 6.4 — Attributs iframe imposes par le package

| Attribut | Valeur |
|---|---|
| `sandbox` | `allow-scripts allow-same-origin allow-forms` |
| `allow` | `camera; microphone; fullscreen` |
| `referrerPolicy` | `strict-origin-when-cross-origin` |
| `width` | `100%` |
| `border` | `none` |

---

## 7. Checklist d'integration

- [ ] j'ai acces a GitHub Packages et `pnpm add @kycly/link` fonctionne
- [ ] mon projet React a bien `react` et `react-dom`
- [ ] mon backend peut relire l'id token Cognito depuis une session HTTP-only signee
- [ ] le token reste cote serveur, jamais cote frontend
- [ ] mon backend applicatif expose une route type `/api/kyc/session`
- [ ] cette route appelle `https://api.kycly.sn/kyclink/create`
- [ ] mon frontend React recupere `kyclinkUrl` depuis **mon** backend
- [ ] mon frontend rend `<KycLink kyclinkUrl={...} />`
- [ ] mes `metadata` respectent `metadataVersion: 1` et les limites de validation