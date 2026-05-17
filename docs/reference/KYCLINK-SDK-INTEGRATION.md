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
4. votre frontend React rend `<KycLink />`

```text
Frontend React
  -> appelle votre backend applicatif

Backend applicatif
  -> POST https://api.kycly.sn/kyclink/create
  -> Authorization: Bearer ck_demo_*
  -> recoit { sessionId, kyclinkUrl, expiresAt }

Frontend React
  -> recoit kyclinkUrl
  -> rend <KycLink kyclinkUrl={...} />
```

**Regle centrale** : n'appelez pas `partner-node` directement depuis le navigateur. La creation de session se fait cote serveur, jamais cote frontend.

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
//npm.pkg.github.com/:_authToken=ghp_xxxxxxxxxxxxxxxxxxxx
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

Pour cette app, `KYCLY_API_BASE_URL` doit toujours pointer vers le runtime sandbox de `partner-node` pour les routes `/kyclink/*`.

La resolution du scope demo via `/demo/me` peut pointer vers un host distinct, configure dans `KYCLY_ME_BASE_URL`.

Pour l'usage interne actuel, l'instance de reference est:

```text
https://api.kycly.sn
```

La route d'integration a utiliser est:

```text
POST https://api.kycly.sn/kyclink/create
```

### 2.3 — Cle machine a utiliser

Le guide suppose un appel **machine-to-machine** vers `partner-node sandbox`.

Dans `whitelabel-vercel`, un seul cas existe:

| Environnement | Token | Usage |
|---|---|---|
| sandbox | `ck_demo_*` | integration M2M sandbox uniquement |

Comment obtenir la cle:

- `ck_demo_*` : cle demo retournee comme `demo_api_key` lors de la validation d'un compte demo ou de sa rotation par un `superadmin`.

Contraintes importantes:

- une `ck_demo_*` ne fonctionne qu'en `sandbox`
- elle doit rester cote serveur uniquement
- elle doit etre selectionnee par lookup strict depuis `DEMO_ACCOUNT_KEY_MAP` a partir du `demo_account_id` Cognito

---

## 3. Appeler `partner-node` depuis votre backend

### 3.1 — Contrat de la route

```http
POST /kyclink/create
Authorization: Bearer ck_demo_<32hex>
Content-Type: application/json
```

Payload attendu:

```ts
{
  externalId: string;
  metadata?: SessionMetadata;
}
```

Dans whitelabel-vercel, `externalId` est derive cote backend a partir de la `Reference client`; il n'est pas expose comme champ technique au frontend.

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
): Promise<CreateKycLinkSessionResponse> {
  const response = await fetch("https://api.kycly.sn/kyclink/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.KYCLY_CLIENT_API_KEY}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`partner-node create failed: ${response.status}`);
  }

  return (await response.json()) as CreateKycLinkSessionResponse;
}
```

### 3.3 — Route a exposer dans votre propre backend

Votre frontend React ne doit pas appeler `https://api.kycly.sn/kyclink/create` directement.

Pattern recommande:

1. votre frontend appelle une route de **votre** backend, par exemple `/api/kyc/session`
2. votre backend appelle `partner-node`
3. votre backend retourne `{ sessionId, kyclinkUrl, expiresAt }`

Exemple Express minimal:

```ts
app.post("/api/kyc/session", async (req, res) => {
  const session = await createKycLinkSession({
    externalId: req.body.externalId,
    metadata: req.body.metadata,
  });

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
import { useEffect, useState } from "react";
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

export function KycLinkPage({ userId }: { userId: string }) {
  const [session, setSession] = useState<KycLinkSession | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (error) {
    return <p>Erreur KYC: {error}</p>;
  }

  if (!session) {
    return <p>Creation de la session KYC...</p>;
  }

  return (
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
  );
}
```

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
5. la page affiche `externalId`, `status`, `completed`, `completedAt` et `validationStatus`
6. les polls suivants utilisent un backoff progressif jusqu'au statut final ou a la limite de tentatives

Autrement dit, `onComplete` clot le parcours iframe, puis un polling backend controle prend le relais pour recuperer la decision metier observable.

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
- [ ] j'ai une cle `ck_demo_*` associee au compte demo vise
- [ ] ma cle est stockee cote serveur, jamais cote frontend
- [ ] mon backend applicatif expose une route type `/api/kyc/session`
- [ ] cette route appelle `https://api.kycly.sn/kyclink/create`
- [ ] mon frontend React recupere `kyclinkUrl` depuis **mon** backend
- [ ] mon frontend rend `<KycLink kyclinkUrl={...} />`
- [ ] mes `metadata` respectent `metadataVersion: 1` et les limites de validation