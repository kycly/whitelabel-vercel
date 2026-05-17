# Decisions fermees J1

Ce document ferme les arbitrages indispensables pour demarrer l'implementation du scaffold.

Il sert de source de verite quand plusieurs documents formulaient la meme idee de maniere differente.

## D1 — Nature de l'independance de l'app

whitelabel-vercel est:

- independant pour son frontend
- independant pour son backend applicatif
- independant pour son deploiement, ses secrets et son UX

Mais au J1, il depend de `partner-node` comme service KYC canonique pour creer les sessions.

Conséquence:

- aucune dependance a la base de `partner-node`
- aucune reutilisation de son UI
- mais un appel serveur assume a `partner-node /kyclink/create`

## D1bis — Portee environnementale de l'app

Au J1, whitelabel-vercel est une application demo branchee uniquement sur le runtime sandbox de `partner-node`.

Cela reste vrai meme si l'app est deployee sur des environnements Vercel distincts `preview` et `production`.

Conséquences:

- `preview` et `production` designent des stades de deploiement de l'app, pas des cibles metier `partner-node preview|production`
- l'app ne manipule que des `ck_demo_*`
- toute liste des verifications utilisateur doit lire `partner-node /kyclink/sessions` en sandbox, scope par `demo_account_id`
- aucune persistance locale des sessions n'est justifiee tant que ce besoin est couvert par `partner-node`

## D2 — Contrat d'authentification

Le J1 utilise un login Cognito direct dans l'application.

Flux retenu:

1. page `LOGIN`
2. saisie email / mot de passe dans l'app
3. recuperation de l'id token Cognito dans le navigateur
4. envoi vers `POST /api/auth/session`
5. etablissement de la session applicative
5. passage vers `AUTH_LOADING`

Conséquence:

- pas d'inscription libre dans l'app
- pas de callbacks OAuth a configurer
- la config doit inclure seulement region, user pool et app client id

## D2bis — Format de session applicative apres callback

Au J1, la session applicative est portee par un cookie serveur.

Format retenu:

- cookie HTTP-only
- `Secure` en preview et production
- `SameSite=Lax`
- scope sur le domaine courant de l'app
- aucune persistance de token Cognito dans `localStorage` ou `sessionStorage`

Contenu attendu:

- identite minimale utilisateur
- resultat de resolution du scope demo via `partner-node /demo/me`
- `demo_account_id`
- aucun token Cognito brut persiste dans la session applicative cote navigateur

Conséquence:

- `GET /api/me` lit cette session serveur
- le frontend ne manipule pas directement les tokens Cognito bruts

## D3 — Contrat des routes internes minimales

Routes J1 retenues:

- `POST /api/auth/session`
- `GET /auth/logout`
- `POST /auth/logout`
- `GET /api/me`
- `POST /api/kyc/session`

## D3bis — Politique de logout preview / production

Le logout J1 suit exactement la meme logique sur preview et production:

1. suppression de la session applicative locale
2. suppression de la session Cognito locale dans le navigateur
3. retour vers `LOGIN`

Regles:

- preview et production suivent la meme logique locale
- pas d'URL de sign-out Cognito a configurer
- pas de comportement different par produit

## D4 — Regle `Reference client` -> `externalId`

L'utilisateur renseigne `Reference client`.

Le backend derive `externalId` selon la regle J1 suivante:

- trim debut / fin
- remplacement des espaces internes par `_`
- longueur maximale cote formulaire: 128 caracteres
- caracteres recommandes: lettres, chiffres, `_`, `-`, `.`
- la valeur normalisee est utilisee comme `externalId`
- la valeur fonctionnelle reste aussi stockee dans `businessContext.customerId`

Conséquence:

- le frontend n'expose pas `externalId`
- `Reference client` est la source metier unique pour cet identifiant au J1

## D4bis — Valeurs du champ `Produit concerne`

La liste J1 du champ `Produit concerne` est fermee a ces valeurs:

- `Compte Standard` -> `standard_account`
- `Compte Premium` -> `premium_account`
- `Prêt / Crédit` -> `credit`
- `Paiement / Wallet` -> `payments`
- `Autre` -> `other`

Regles:

- champ optionnel
- aucune valeur par defaut obligatoire
- si `Autre` est choisi, afficher un champ texte court `Produit (autre)` et stocker la valeur libre dans `businessContext.product`

## D5 — Regle sur le telephone

Au J1:

- pas de telephone obligatoire
- telephone de notification optionnel
- pre-remplissage si l'information existe deja et est fiable
- canal `sms` visible seulement si un telephone valide est renseigne

Conséquence:

- la phrase `pas de saisie de telephone` doit se lire comme `pas de saisie de telephone obligatoire`

## D6 — Format de `DEMO_ACCOUNT_KEY_MAP`

Le J1 retient un format JSON serveur unique:

```json
{
  "demo_acme": "ck_demo_xxx",
  "demo_beta": "ck_demo_yyy"
}
```

Regles:

- la map reste cote serveur uniquement
- lookup strict par `demo_account_id`
- aucun fallback silencieux
- absence de mapping -> erreur serveur explicite

## D7 — Contrat de creation de session

Le backend de whitelabel-vercel doit, dans cet ordre:

1. valider la session utilisateur
2. resoudre le scope demo via `partner-node /demo/me`
3. verifier l'acces applicatif
4. resoudre `demo_account_id`
5. deriver `externalId`
6. construire `metadata`
7. resoudre `ck_demo_*`
8. appeler `partner-node /kyclink/create`
9. renvoyer `{ sessionId, kyclinkUrl, expiresAt }`

Le meme cadrage vaut pour la lecture de resultat et pour la liste de sessions exposee par l'app:

- `GET /api/kyc/session/:sessionId/result` appelle `partner-node` sandbox avec la `ck_demo_*` du compte courant
- `GET /api/kyc/sessions` appelle `partner-node /kyclink/sessions` avec la meme contrainte de scope demo

## D7bis — Contrat de la liste `Mes verifications`

La route `GET /api/kyc/sessions` ne doit pas etre un miroir brut de `partner-node /kyclink/sessions`.

Elle devra exposer une projection minimale, stable et user-facing.

Champs cibles par item:

- `sessionId`
- `externalId`
- `status`
- `completed`
- `completedAt`
- `expiresAt`
- `createdAt`

Champs explicitement exclus:

- `id`
- `demo_account_id`
- `kyclink_url`
- `webhook_payload`
- `metadata`
- `updated_at`

Pagination cible:

- `limit` par defaut `20`
- `limit` max `50`
- `offset` par defaut `0`
- pas de `total` ni de `hasMore` au premier jet

La specification detaillee a suivre avant implementation se trouve dans [reference/KYC-SESSIONS-LIST-CONTRACT.md](reference/KYC-SESSIONS-LIST-CONTRACT.md).

## D8 — Etat des trous restants

Les trous critiques du J1 sont maintenant fermes.

Les seuls sujets encore ouverts, non bloquants pour demarrer, sont:

- nom exact du cookie de session applicative
- format exact de chiffrement / signature de cette session
- microcopy finale du champ `Produit (autre)`
- politique fine de TTL de session cote app

Ces points relevent surtout de l'implementation et non plus du cadrage structurel.