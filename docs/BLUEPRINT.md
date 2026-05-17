# Blueprint — whitelabel-vercel

## Objectif

Construire une application web de demonstration / whitelabel pour @kycly/link, independante de partner-node pour son runtime, mais utilisant le meme user pool Cognito afin de reutiliser des utilisateurs deja provisionnes.

## Decisions retenues

- application top-level dediee: oui
- projet Vercel dedie: oui
- GitHub Environments dedies: oui
- meme user pool Cognito que partner-node: oui
- app client Cognito dedie: oui
- backend applicatif dedie: oui
- portee metier sandbox-only: oui
- base dediee au J1: non
- acces direct a la base partner-node: non
- dependance de service au backend partner-node sandbox pour creer et lire les sessions: oui
- creation de session avec JWT Cognito seul: non
- creation de session cote serveur avec ck_demo_*: oui
- une app multi-tenant pour plusieurs demo testeurs: oui
- meme canon esthetique UI/UX que integration-node, mais implemente localement dans whitelabel-vercel: oui

## Architecture J1

```text
Utilisateur
  -> Login Cognito Hosted UI
  -> whitelabel-vercel frontend
  -> whitelabel-vercel backend
  -> partner-node sandbox /kyclink/create via ck_demo_*
  -> @kycly/link
```

## Flux nominal

1. partner-node cree le user en amont dans le meme user pool Cognito.
2. L'utilisateur arrive sur une page de connexion dediee a whitelabel-vercel.
3. Il se connecte via le client Cognito dedie.
4. Le frontend recupere un JWT Cognito.
5. Le frontend appelle le backend de whitelabel-vercel avec ce JWT.
6. Le backend valide le JWT.
7. Le backend lit les claims utiles, notamment le droit d'acces a l'app et le compte demo cible.
8. Le backend derive `externalId` a partir de la reference client.
9. Le backend resout la bonne cle ck_demo_* a utiliser.
10. Le backend appelle `partner-node` pour creer la session.
11. Le backend renvoie sessionId, kyclinkUrl et les metadonnees minimales utiles au frontend.
12. Le frontend affiche @kycly/link.
13. A la fin du parcours iframe, le frontend va vers `COMPLETE`, attend au moins 10 secondes puis interroge son backend pour lire le resultat courant de la session.
14. Le backend de whitelabel-vercel appelle `partner-node sandbox /kyclink/:sessionId/result` et remonte `externalId`, `status`, `completed`, `completedAt` et `validationStatus`.

## Contrat d'autorisation minimal

Le token Cognito doit transporter assez d'information pour autoriser l'acces sans appel runtime a partner-node.

Claims minimum recommandes:

- sub
- email
- custom:kyc_demo_access
- custom:demo_account_id

Exemple logique:

```json
{
  "sub": "2a9e1d6f-xxxx-xxxx-xxxx-6e0f0f3e1e10",
  "email": "demo.user@example.com",
  "custom:kyc_demo_access": "true",
  "custom:demo_account_id": "demo_acme"
}
```

## Regles de securite

- le frontend ne voit jamais de ck_demo_*
- le JWT Cognito sert a authentifier l'utilisateur, pas a remplacer la credential serveur
- le backend verifie l'acces avant toute creation de session
- le backend choisit la ck_demo_* a partir du compte demo autorise
- `KYCLY_API_BASE_URL` doit cibler le runtime sandbox de partner-node
- l'app n'utilise ni la base ni le backend runtime de partner-node

## Canon UI/UX local

Le scaffold doit conserver le meme langage esthetique que integration-node, sans dependance technique vers lui.

Contraintes:

- les tokens, animations, layouts et composants doivent etre definis dans whitelabel-vercel
- aucun import cross-project depuis integration-node
- toute divergence visuelle volontaire doit etre explicite et documentee localement

Le canon local a maintenir se trouve dans [reference/UI-ESTHETIC-CANON.md](reference/UI-ESTHETIC-CANON.md).

## Variables d'environnement cibles

Variables publiques:

- NEXT_PUBLIC_AWS_REGION
- NEXT_PUBLIC_COGNITO_USER_POOL_ID
- NEXT_PUBLIC_COGNITO_APP_CLIENT_ID
- NEXT_PUBLIC_COGNITO_DOMAIN
- NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN
- NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT
- NEXT_PUBLIC_APP_ENV

Variables serveur:

- COGNITO_JWKS_URL
- COGNITO_ISSUER
- COGNITO_CLIENT_SECRET si le flux retenu en a besoin
- KYCLY_API_BASE_URL
- DEMO_ACCOUNT_KEY_MAP
- DEFAULT_KYCLINK_THEME

Politique J1:

- session applicative via cookie HTTP-only securise
- pas de stockage des tokens Cognito dans `localStorage`

Notes:

- DEMO_ACCOUNT_KEY_MAP designe une configuration serveur qui mappe un demo_account_id a une ck_demo_*.
- Cette config doit rester cote serveur uniquement.
- Format J1 recommande pour DEMO_ACCOUNT_KEY_MAP: JSON objet `{ "demo_account_id": "ck_demo_xxx" }`.
- Absence de mapping pour un `demo_account_id` autorise: erreur serveur explicite, jamais de fallback silencieux.

## Environnements de deploiement

Vercel:

- preview
- production

Important:

- `preview` et `production` designent ici des stades de deploiement de l'app whitelabel, pas un basculement automatique entre `partner-node sandbox` et `partner-node production`
- tant que ce blueprint n'est pas explicitement revise, les deux environnements Vercel restent relies au perimetre demo / sandbox

GitHub Environments recommandes:

- vercel-preview
- vercel-production

## Structure initiale recommandee

```text
whitelabel-vercel/
  AGENTS.md
  README.md
  docs/
    BLUEPRINT.md
  app/
    login/
    verify/
    api/
      auth/
      kyc/
  src/
    auth/
    server/
    config/
    lib/
  public/
```

## Endpoints backend minimaux

- GET /auth/login
- GET /auth/callback
- POST /auth/logout
- GET /api/me
- POST /api/kyc/session
- GET /api/kyc/session/:sessionId/result
- GET /api/kyc/sessions

Responsabilites:

- GET /auth/login redirige vers Cognito Hosted UI
- GET /auth/callback recupere le retour Cognito et etablit la session applicative via cookie serveur
- POST /auth/logout termine la session applicative puis declenche le logout Cognito avec l'URL de retour de l'environnement courant
- GET /api/me valide le JWT et expose l'identite autorisee minimale
- POST /api/kyc/session valide le JWT, determine le compte demo, derive `externalId`, selectionne la bonne ck_demo_*, cree la session via partner-node et renvoie la charge utile necessaire au frontend
- GET /api/kyc/session/:sessionId/result valide la session utilisateur, appelle partner-node pour lire le resultat courant et renvoie l'etat KYC consolide au frontend
- GET /api/kyc/sessions valide la session utilisateur, appelle `partner-node sandbox /kyclink/sessions` et expose uniquement la liste du `demo_account_id` courant sans persistance locale supplementaire

Le contrat cible de cette future route est detaille dans [reference/KYC-SESSIONS-LIST-CONTRACT.md](reference/KYC-SESSIONS-LIST-CONTRACT.md).

## Ce qu'on ne fait pas au J1

- aucune base de donnees dediee
- aucun appel runtime a partner-node pour resoudre les droits
- aucun stockage local avance des sessions
- aucun backoffice
- aucun deploiement par tenant

## Evolutions possibles plus tard

Ajouter une persistance dediee seulement si l'un des besoins suivants devient reel:

- audit local des sessions creees
- mapping user -> demo_account hors claims Cognito
- branding fort par tenant
- analytics ou parcours applicatifs persistants
- backoffice propre a l'app

Avant toute persistance locale, l'evolution deja retenue est:

1. exposer un proxy serveur `GET /api/kyc/sessions`
2. consommer `partner-node sandbox /kyclink/sessions`
3. conserver `partner-node` comme source canonique des sessions demo

## Prochaine etape recommandee

Implementer le scaffold applicatif minimal avec:

1. Next.js App Router
2. integration Cognito pour login utilisateur
3. verification serveur des JWT
4. route POST /api/kyc/session
5. page verify qui initialise @kycly/link a partir d'une session creee cote serveur

## Documentation de reference

- decisions fermees J1: [DECISIONS-J1.md](DECISIONS-J1.md)
- parcours J1: [PARCOURS-J1.md](PARCOURS-J1.md)
- UX page de connexion: [reference/AUTH-UX.md](reference/AUTH-UX.md)
- UX metadata de session: [reference/SESSION-CONTEXT-UX.md](reference/SESSION-CONTEXT-UX.md)
- contrat futur de liste des verifications: [reference/KYC-SESSIONS-LIST-CONTRACT.md](reference/KYC-SESSIONS-LIST-CONTRACT.md)
- guide d'integration React du SDK: [reference/KYCLINK-SDK-INTEGRATION.md](reference/KYCLINK-SDK-INTEGRATION.md)
- canon UI/UX local: [reference/UI-ESTHETIC-CANON.md](reference/UI-ESTHETIC-CANON.md)
