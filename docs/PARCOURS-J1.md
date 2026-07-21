# Parcours J1

Ce document definit le parcours produit et UX a implementer avant toute construction du frontend.

Le but du J1 est volontairement etroit:

- laisser un utilisateur deja provisionne se connecter
- verifier qu'il a acces a l'application
- creer une session KYC pour son compte demo
- embarquer @kycly/link
- afficher une fin de parcours claire

Le J1 ne couvre pas:

- backoffice
- consultation de resultats metier detailes
- administration du compte demo

Le J1 couvre en revanche une reprise bornee d'une session KYC existante quand:

- la session appartient au compte demo courant
- la session n'est pas terminee
- la date `expiresAt` n'est pas depassee

## Principe general

Le parcours doit rester plus simple que integration-node.

integration-node orchestre un flux KYC complet ecran par ecran.
whitelabel-vercel, au J1, orchestre surtout:

- l'acces utilisateur
- l'autorisation
- la creation de session
- l'embarquement du Link
- la sortie de parcours

## Ecrans du J1

Le parcours cible contient 10 etats d'ecran.

1. `LOGIN`
2. `AUTH_LOADING`
3. `ACCESS_DENIED`
4. `WELCOME`
5. `SESSION_CONTEXT`
6. `SESSION_PREPARE`
7. `KYC_LINK`
8. `COMPLETE`
9. `FAILURE`
10. `SESSIONS`

## Vue d'ensemble

```text
LOGIN
  -> AUTH_LOADING     quand l'utilisateur lance la connexion Cognito

AUTH_LOADING
  -> LOGIN            si aucun token n'est present
  -> ACCESS_DENIED    si user non autorise
  -> WELCOME          si user authentifie et autorise

WELCOME
  -> SESSION_CONTEXT  quand l'utilisateur demarre
  -> SESSIONS         quand l'utilisateur veut relire ses verifications deja connues

SESSION_CONTEXT
  -> SESSION_PREPARE  quand le contexte de session est valide
  -> WELCOME          si l'utilisateur revient en arriere

SESSION_PREPARE
  -> KYC_LINK         si la session est creee
  -> FAILURE          si la creation echoue

KYC_LINK
  -> COMPLETE         quand onComplete est emis par le SDK
  -> FAILURE          si erreur bloquante ou si la session relue n'est plus reprenable

FAILURE
  -> SESSION_PREPARE  si retry possible
  -> WELCOME          si on veut relancer depuis le debut

COMPLETE
  -> SESSIONS         via l'icone retour harmonisee vers la liste des sessions verifiees
  -> WELCOME          via la sortie positive explicite quand elle est disponible

SESSIONS
  -> WELCOME          pour revenir a l'accueil
  -> SESSION_CONTEXT  via creation d'une nouvelle session
  -> KYC_LINK         via reprise d'une session incomplete et non expiree
```

## 1. LOGIN

### Role

Page de connexion explicite, premiere surface visible pour un utilisateur non authentifie.

### Objectif UX

- poser clairement la promesse de l'application
- eviter une redirection opaque des la premiere seconde
- donner une entree simple vers Cognito

### Contenu minimal

- logo et branding de l'app
- titre clair du type `Connectez-vous pour lancer une verification`
- sous-texte bref expliquant qu'un compte demo actif est requis
- CTA principal `Se connecter`
- zone secondaire courte sur la confidentialite et les permissions attendues

### Ce qu'on n'affiche pas

- details techniques Cognito
- informations de tenant ou de claims
- details sur les tokens ou la session serveur

### Sorties possibles

- vers `AUTH_LOADING` apres validation de la session Cognito

### Reference detaillee

La page de connexion et son contrat UX sont detailles dans [reference/AUTH-UX.md](reference/AUTH-UX.md).

## 2. AUTH_LOADING

### Role

Premier ecran technique, tres court, qui etablit l'etat d'authentification.

### Objectif UX

- ne pas exposer tout de suite un ecran cassé
- afficher un chargement propre et rassurant
- decider rapidement entre acces autorise et acces refuse

### Verification attendue

- token Cognito present
- token valide
- claim d'acces a l'app present
- `demo_account_id` resolu
- session applicative avec id token Cognito stocke cote serveur

### Sorties possibles

- vers `LOGIN` si aucun token n'est present
- vers `WELCOME` si tout est valide
- vers `ACCESS_DENIED` sinon

## 3. ACCESS_DENIED

### Role

Ecran de garde si l'utilisateur ne peut pas utiliser l'application.

### Cas couverts

- utilisateur non connecte
- utilisateur connecte mais non autorise
- claims incomplets
- compte demo non resolu

### Message UX

Le ton doit rester neutre et propre:

- expliquer que l'acces n'est pas disponible pour ce compte
- proposer de revenir a la connexion ou de contacter le support approprie

### CTA

- `Se reconnecter`
- optionnel: `Retour`

## 4. WELCOME

### Role

Ecran d'accueil du parcours.

### Contenu minimal

- titre simple de verification d'identite
- resume court des etapes a venir
- rappel des permissions demandees: camera, microphone si necessaire
- CTA principal `Commencer`

### Intention UX

- rassurer
- donner du contexte
- ne pas surcharger l'utilisateur d'informations techniques
- ne pas afficher d'icone retour sur cet ecran

### Donnees affichees

- prenom/nom ou email si disponible
- compte demo cible si utile a la comprehension

## 5. SESSION_CONTEXT

### Role

Ecran de preparation fonctionnelle de la session avant l'appel backend.

### Objectif UX

- permettre a l'utilisateur de renseigner les metadata utiles sans lui exposer la taxonomie technique
- guider la saisie avec des questions metier simples
- rester beaucoup plus intuitif que l'interface d'administration de partner-node

### Principe

L'utilisateur ne voit pas `notificationContext`, `businessContext`, `routingContext`, `complianceContext` ou `customContext`.
Il voit des blocs metier simples, puis l'application genere l'objet `metadata` conforme au contrat backend.

### Structure recommande

L'ecran est compose de 3 niveaux:

1. un choix de scenario rapide
2. un petit formulaire guide
3. des ajouts optionnels inline, a la demande

### Scenarios rapides

Jeu de scenarios recommande au J1:

- `Onboarding`
- `Mise a jour dossier`
- `Verification ponctuelle`
- `Autre`

Le scenario choisi pre-remplit les champs et determine le ton du formulaire.

### Champs visibles au J1

Blocs recommandes:

- `Noyau minimal`
- `Ajouts a la demande`

Champs concrets:

| Bloc | Champ visible | Statut | Destination metadata |
|---|---|---|---|
| Noyau minimal | External ID | obligatoire | `businessContext.customerId` |
| Noyau minimal | Notification SMS | optionnel | `notificationContext.phone` + `preferredChannel = sms` |
| Ajouts a la demande | Contexte metier | optionnel | `businessContext.*` |
| Ajouts a la demande | Contexte routage | optionnel | `routingContext.*` |
| Ajouts a la demande | Email | optionnel | `notificationContext.email` + `preferredChannel = email` |
| Ajouts a la demande | Contexte libre | optionnel | `customContext.*` |

### Ce qu'on n'expose pas au J1

- `complianceContext` en saisie libre
- editeur JSON brut
- taxonomie technique des contexts
- liste libre de dizaines de champs

### Ajouts a la demande

Les ajouts restent masques par defaut et s'activent depuis une checklist `Besoins optionnels`.

Les groupes exposes sont alignes sur les categories `partner-node`:

- `Contexte metier`
- `Contexte routage`
- `Email`
- `Contexte libre`

Une fois un groupe active, son panneau apparait inline dans le formulaire et peut etre referme via une action de suppression discrete.

### Validation UX

- valider en direct les champs email et telephone
- bloquer les cles interdites dans la section avancee
- garder des messages de validation metier, pas techniques
- empecher l'envoi si `External ID` est absent
- limiter `External ID` a 128 caracteres

### CTA

- primaire: `Creer la session`
- secondaire: `Retour`

### Sorties possibles

- succes -> `SESSION_PREPARE`
- retour -> `WELCOME`

### Reference detaillee

Le choix des champs, des libelles et du mapping est detaille dans [reference/SESSION-CONTEXT-UX.md](reference/SESSION-CONTEXT-UX.md).
Les listes exactes du J1 pour `Type de verification`, `Pays`, `Segment`, `Priorite` et `Canal prefere` y sont maintenant figees.

## 6. SESSION_PREPARE

### Role

Etat intermediaire pendant lequel le backend cree la session KYC.

### Ce qui se passe techniquement

- le frontend appelle `POST /api/kyc/session`
- le backend verifie le JWT
- le backend determine le `demo_account_id`
- le backend derive `externalId` a partir de la reference client
- le backend resout `parentOrigin` cote serveur depuis `APP_CANONICAL_ORIGIN`, sinon depuis les headers forwardes / le host de la requete
- le backend reutilise l'id token Cognito stocke dans la session serveur
- le backend appelle `partner-node` pour creer la session

### UX attendue

- loader clair
- message simple du type `Preparation de votre session de verification...`
- pas d'informations techniques de type token, tenant ou API

### Sorties possibles

- succes -> `KYC_LINK`
- echec recuperable -> `FAILURE`

## 7. KYC_LINK

### Role

Ecran principal du produit au J1.

### Contenu

- le composant `KycLink`
- un cadre visuel cohérent avec le langage integration-node
- un espace d'aide tres leger si la camera ou le navigateur bloquent le flux

### Regles UX

- l'iframe doit etre au centre du parcours
- les elements parasites autour doivent etre minimaux
- le CTA principal disparait au profit du flux embarque
- on garde une issue claire en cas d'erreur bloquante
- aucune icone retour n'est affichee sur cet ecran
- aucune action de deconnexion n'est affichee sur cet ecran

### Evenements ecoutes

- `onReady`
- `onStep`
- `onComplete`
- `onError`

### Important

`onComplete` veut dire fin du parcours UX dans le Link, pas decision metier finale detaillee.

## 8. COMPLETE

### Role

Ecran de resultat et de sortie positive du parcours iframe.

### Objectif UX

- confirmer que le parcours KYC a ete termine
- expliquer sobrement que la lecture backend peut encore etre en cours
- proposer des suites courtes et cohérentes: actualiser, relire l'historique, relancer une verification, revenir a l'accueil

### Contenu minimal

- un etat de progression avant le premier poll
- un resume lisible de la reference, du statut, de la decision et de la date de finalisation quand disponibles
- des actions utilitaires compactes, principalement en icones
- une icone retour harmonisee vers la liste des sessions verifiees
- un retour accueil explicite quand une sortie positive est disponible

### Principe

Au J1, `onComplete` du SDK signifie que l'utilisateur a termine le parcours KycLink, pas que la decision backend est deja disponible.

L'ecran `COMPLETE` doit donc:

- confirmer la fin du parcours iframe
- attendre au moins 10 secondes avant le premier poll backend
- interroger ensuite `/api/kyc/session/:sessionId/result`
- replier cote serveur sur `GET /kyclink/sessions` si la route detail upstream repond `404`
- afficher `externalId`, `status`, `completed`, `completedAt` et `workflowStatus`
- arreter le polling quand `completed = true` ou quand la limite de tentatives est atteinte
- utiliser un backoff progressif entre les polls suivants plutot qu'un intervalle fixe

### Etats attendus

- attente avant premier poll
- polling en cours
- resultat backend sans statut metier rattache, affiche comme `TRAIT. EN COURS`
- resultat backend avec `workflowStatus = APPROVED`
- resultat backend avec `workflowStatus = REJECTED`
- resultat backend avec `workflowStatus = IN_REVIEW`
- echec temporaire de lecture backend

### CTA

- `Actualiser`
- `Mes verifications`
- `Nouvelle verification`
- `Retour accueil`

## 9. FAILURE

### Role

Ecran d'erreur simple, unique et reutilisable.

### Cas couverts

- creation de session en echec
- erreur technique du composant KycLink
- probleme d'environnement navigateur
- erreur reseau bloquante

### UX attendue

- erreur lisible et non alarmiste
- diagnostic utilisateur court
- CTA primaire `Reessayer`
- CTA secondaire `Retour a l'accueil`

## Donnees minimales par etat

| Ecran | Donnees requises |
|---|---|
| `LOGIN` | aucune donnee metier, seulement le point d'entree Cognito |
| `AUTH_LOADING` | token utilisateur |
| `ACCESS_DENIED` | raison fonctionnelle resumee |
| `WELCOME` | identite minimale utilisateur |
| `SESSION_CONTEXT` | scenario, reference client, metadata derivees |
| `SESSION_PREPARE` | aucune donnee supplementaire visible |
| `KYC_LINK` | `sessionId`, `kyclinkUrl`, `expiresAt` |
| `COMPLETE` | `sessionId` optionnel |
| `FAILURE` | code erreur simplifie + message affichable |

## Composants d'orchestration a prevoir

Le frontend devra probablement etre structure autour de:

- une page route principale de parcours
- une page de connexion dediee
- un orchestrateur d'etats d'ecran
- un layout de parcours commun
- un composant d'etat de chargement auth
- un composant d'etat d'erreur
- un composant de formulaire de contexte de session
- un composant d'embarquement `KycLink`

## Regles de simplification J1

- pas de saisie de telephone obligatoire
- pas de saisie d'externalId brute si elle peut etre derivee de la `Reference client`
- pas de selection de type de document dans l'app si KycLink le gere deja
- pas de duplication de logique KYC hors du Link
- pas de navigation complexe multi-pages si un orchestrateur simple suffit

Note:

- l'ecran `SESSION_CONTEXT` remplace une partie de la complexite technique par des choix metier guides
- si le telephone est deja connu et fiable cote compte, il peut etre pre-rempli et rester editable ou non selon la politique produit

## Decisions ouvertes a trancher avant implementation

Ces points doivent etre figes juste avant le frontend:

1. route unique de parcours ou plusieurs pages dediees
2. quelle donnee utilisateur afficher sur `WELCOME`
3. faut-il afficher le `sessionId` sur `COMPLETE`
4. niveau exact de detail des erreurs utilisateur
5. faut-il autoriser un `retry` direct depuis `FAILURE`

## Recommandation de mise en oeuvre

Avant de coder les composants, figer au minimum:

1. la machine d'etats ci-dessus
2. la liste finale des ecrans
3. les CTA de chaque ecran
4. les donnees minimales visibles par ecran
5. les cas d'erreur qui redirigent vers `FAILURE`

Une fois ce document valide, le frontend peut etre implemente sans ambiguite structurelle.