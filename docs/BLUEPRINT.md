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
- creation de session avec JWT Cognito cote serveur: oui
- une app multi-tenant pour plusieurs demo testeurs: oui
- meme canon esthetique UI/UX que integration-node, mais implemente localement dans whitelabel-vercel: oui

## Architecture J1

```text
Utilisateur
  -> Login Cognito direct
  -> whitelabel-vercel frontend
  -> whitelabel-vercel backend
  -> partner-node sandbox /kyclink/create via JWT Cognito serveur
  -> @kycly/link
```

## Flux nominal

1. partner-node cree le user en amont dans le meme user pool Cognito.
2. L'utilisateur arrive sur une page de connexion dediee a whitelabel-vercel.
3. Il se connecte via le client Cognito dedie.
4. Le frontend recupere un JWT Cognito.
5. Le frontend appelle le backend de whitelabel-vercel avec ce JWT.
6. Le backend valide le JWT.
7. Le backend resout le droit d'acces a l'app et le compte demo cible via `partner-node /demo/me`.
8. Le backend derive `externalId` a partir de la reference client.
9. Le backend reutilise l'id token Cognito stocke dans la session HTTP-only.
10. Le backend derive aussi `parentOrigin` depuis la requete HTTP puis appelle `partner-node` pour creer la session.
11. Le backend renvoie sessionId, kyclinkUrl et les metadonnees minimales utiles au frontend.
12. Le frontend affiche @kycly/link.
13. A la fin du parcours iframe, le frontend va vers `COMPLETE`, attend au moins 10 secondes puis interroge son backend pour lire le resultat courant de la session.
14. Le backend de whitelabel-vercel appelle `partner-node sandbox /kyclink/:sessionId/result` et remonte `externalId`, `status`, `completed`, `completedAt` et `validationStatus`.
15. Si cette lecture detaillee remonte `404`, l'app replie sur l'index `GET /kyclink/sessions` pour reconstruire un etat minimal de resultat au lieu de casser la page `COMPLETE`.

## Contrat d'autorisation minimal

Le token Cognito doit permettre d'etablir l'identite utilisateur.

La resolution du droit d'acces demo et du `demo_account_id` se fait ensuite via `partner-node /demo/me`, qui derive le scope sandbox a partir du `sub` Cognito et de la liaison locale vers un compte demo.

Claims minimum attendus:

- sub
- email

## Regles de securite

- le frontend ne voit jamais le JWT Cognito brut une fois la session applicative etablie
- le backend verifie l'acces via `partner-node /demo/me` avant toute creation de session
- le backend reutilise l'id token Cognito verifie pour authentifier les appels `partner-node /kyclink/*`
- `KYCLY_API_BASE_URL` doit cibler le runtime sandbox de partner-node pour la creation de session et les lectures detaillees `/kyclink/*`
- `KYCLY_SESSION_BASE_URL` peut cibler un host distinct pour `GET /kyclink/sessions`; si absente, l'app replie sur `KYCLY_API_BASE_URL`
- `KYCLY_ME_BASE_URL` doit cibler l'hote exposant `/demo/me`
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
- NEXT_PUBLIC_APP_ENV

Variables serveur:

- KYCLY_API_BASE_URL
- KYCLY_SESSION_BASE_URL
- KYCLY_ME_BASE_URL
- DEFAULT_KYCLINK_THEME

Politique J1:

- session applicative via cookie HTTP-only securise
- pas de stockage des tokens Cognito dans `localStorage`

Notes:

- l'id token Cognito est conserve uniquement cote serveur dans le cookie HTTP-only signe.
- `partner-node` resout le scope demo a partir du `sub` Cognito et du contexte local.
- aucune map locale `demo_account_id -> ck_demo_*` n'est maintenue dans whitelabel-vercel.

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
    access-denied/
    auth-loading/
    complete/
    failure/
    login/
    sessions/
    verify/
      prepare/
      session/
    welcome/
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

- POST /api/auth/session
- GET /auth/logout
- POST /auth/logout
- GET /api/me
- POST /api/kyc/session
- GET /api/kyc/session/:sessionId/result
- GET /api/kyc/sessions

Responsabilites:

- POST /api/auth/session verifie l'id token Cognito et etablit la session applicative via cookie serveur
- GET /auth/logout et POST /auth/logout terminent la session applicative locale
- GET /api/me lit la session applicative et expose l'identite autorisee minimale
- POST /api/kyc/session valide la session, determine le compte demo, derive `externalId`, derive aussi l'origin parent a partir de la requete HTTP, reutilise l'id token Cognito serveur, cree la session via partner-node et renvoie la charge utile necessaire au frontend
- GET /api/kyc/session/:sessionId/result valide la session utilisateur, appelle partner-node pour lire le resultat courant et renvoie l'etat KYC consolide au frontend, avec repli sur l'index des sessions si la route detail upstream repond `404`
- GET /api/kyc/sessions valide la session utilisateur, appelle `partner-node sandbox /kyclink/sessions` et expose uniquement la liste du `demo_account_id` courant sans persistance locale supplementaire

Le contrat de cette route est detaille dans [reference/KYC-SESSIONS-LIST-CONTRACT.md](reference/KYC-SESSIONS-LIST-CONTRACT.md).

## Ce qu'on ne fait pas au J1

- aucune base de donnees dediee
- aucun stockage local avance des sessions
- aucun backoffice
- aucun deploiement par tenant

## Evolutions possibles plus tard

Ajouter une persistance dediee seulement si l'un des besoins suivants devient reel:

- audit local des sessions creees
- mapping user -> demo_account hors partner-node
- branding fort par tenant
- analytics ou parcours applicatifs persistants
- backoffice propre a l'app

Avant toute persistance locale, l'evolution deja retenue est:

1. exposer un proxy serveur `GET /api/kyc/sessions`
2. consommer `partner-node sandbox /kyclink/sessions`
3. conserver `partner-node` comme source canonique des sessions demo

## Etat implemente a date

Le projet couvre maintenant ce socle executable:

1. login Cognito direct et session applicative HTTP-only
2. tunnel protege complet `WELCOME -> SESSION_CONTEXT -> SESSION_PREPARE -> KYC_LINK -> COMPLETE`
3. historique `SESSIONS` scope au `demo_account_id` courant
4. lecture resultat robuste avec fallback serveur sur l'index des sessions
5. smokes Playwright sur tunnel principal, fallback logout et parcours mobile protege

## Documentation de reference

- decisions fermees J1: [DECISIONS-J1.md](DECISIONS-J1.md)
- parcours J1: [PARCOURS-J1.md](PARCOURS-J1.md)
- UX page de connexion: [reference/AUTH-UX.md](reference/AUTH-UX.md)
- UX metadata de session: [reference/SESSION-CONTEXT-UX.md](reference/SESSION-CONTEXT-UX.md)
- contrat futur de liste des verifications: [reference/KYC-SESSIONS-LIST-CONTRACT.md](reference/KYC-SESSIONS-LIST-CONTRACT.md)
- guide d'integration React du SDK: [reference/KYCLINK-SDK-INTEGRATION.md](reference/KYCLINK-SDK-INTEGRATION.md)
- canon UI/UX local: [reference/UI-ESTHETIC-CANON.md](reference/UI-ESTHETIC-CANON.md)
