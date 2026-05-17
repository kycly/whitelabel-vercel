# UX metadata de session

Ce document choisit les bonnes questions a poser a l'utilisateur avant la creation de session.

Le principe retenu est simple:

- on ne demande pas a l'utilisateur de construire un objet `metadata`
- on lui pose des questions metier courtes et comprehensibles
- l'application mappe ensuite les reponses vers les bons contexts techniques

## Objectif

Avant `POST /api/kyc/session`, le frontend doit collecter juste assez d'information pour enrichir la session.

Le detail des arbitrages J1 est ferme dans [../DECISIONS-J1.md](../DECISIONS-J1.md).

Le bon compromis UX est:

- peu de champs
- vocabulaire metier
- presets utiles
- validation immediate
- extension avancee facultative

## Pourquoi cette approche

partner-node peut se permettre une surface plus technique.
whitelabel-vercel doit etre plus direct, plus guidant et plus rassurant.

Donc:

- pas de contexts exposes dans l'UI
- pas d'editeur JSON au premier niveau
- pas de formulaire fourre-tout

## Structure de l'ecran

L'ecran `SESSION_CONTEXT` est decoupe en 4 zones.

1. Scenario
2. Contexte de verification
3. Notifications
4. Options avancees

Le header de cet ecran conserve aussi une action de deconnexion visible et immediate, placee en haut a droite, pour permettre de quitter la session demo sans casser le flux guide du formulaire.

## 1. Scenario

Le scenario est un choix par cartes.

Options recommandees:

- `Onboarding`
- `Mise a jour dossier`
- `Verification ponctuelle`
- `Autre`

### Role UX du scenario

- rassurer l'utilisateur
- donner un point de depart clair
- pre-remplir certains champs
- eviter de lui demander de tout comprendre d'emblee

### Mapping technique

| Scenario | Mapping par defaut |
|---|---|
| `Onboarding` | `routingContext.journey = onboarding` |
| `Mise a jour dossier` | `routingContext.journey = profile_update` |
| `Verification ponctuelle` | `routingContext.journey = one_off_check` |
| `Autre` | `routingContext.journey = other` |

## 2. Contexte de verification

Ce bloc porte les questions centrales du parcours.

### Champs retenus

| Libelle UX | Type | Regle | Mapping |
|---|---|---|---|
| `Type de verification` | select | obligatoire | `routingContext.journey` |
| `Reference client` | text | obligatoire | `businessContext.customerId` |
| `Pays` | select | recommande | `businessContext.country` |
| `Produit` | select ou text court | optionnel | `businessContext.product` |
| `Segment` | select | optionnel | `businessContext.segment` |
| `Priorite` | select | optionnel | `routingContext.priority` |

#### Produit concerne

| Libelle UX | Valeur stockee | Usage |
|---|---|---|
| `Compte Standard` | `standard_account` | parcours demo compte standard |
| `Compte Premium` | `premium_account` | parcours demo premium |
| `Prêt / Crédit` | `credit` | verification liee a un dossier credit |
| `Paiement / Wallet` | `payments` | verification liee a un produit paiement |
| `Autre` | `other` | cas hors categories precedentes |

Regle produit:

- champ optionnel
- pas de valeur par defaut obligatoire
- si `Autre` est choisi, afficher un champ libre `Produit (autre)`

### Valeurs exactes J1

Les listes ci-dessous sont figees pour le J1.

#### Type de verification

| Libelle UX | Valeur stockee | Usage |
|---|---|---|
| `Onboarding` | `onboarding` | creation ou premiere verification |
| `Mise a jour dossier` | `profile_update` | mise a jour d'un dossier existant |
| `Verification ponctuelle` | `one_off_check` | verification isolee hors parcours recurrent |
| `Autre` | `other` | cas hors categories precedentes |

Regle produit:

- si un scenario a deja ete choisi dans les cartes du haut, ce select est pre-rempli avec la meme valeur
- `Onboarding` est la valeur par defaut recommandee si aucun contexte meilleur n'est connu

#### Pays

Le select `Pays` reprend une liste courte, issue des pays deja supportes dans integration-node pour la saisie telephone, afin de garder un referentiel simple et coherent.

| Libelle UX | Valeur stockee |
|---|---|
| `Sénégal` | `SN` |
| `France` | `FR` |
| `États-Unis` | `US` |
| `Canada` | `CA` |
| `Royaume-Uni` | `GB` |
| `Allemagne` | `DE` |
| `Italie` | `IT` |
| `Espagne` | `ES` |
| `Suisse` | `CH` |
| `Belgique` | `BE` |
| `Maroc` | `MA` |
| `Algérie` | `DZ` |
| `Tunisie` | `TN` |
| `Côte d'Ivoire` | `CI` |
| `Autre` | `OTHER` |

Regle produit:

- si `Autre` est choisi, afficher un champ texte court `Pays (autre)` et stocker la valeur libre dans `businessContext.country`
- si un pays fiable est connu via le compte ou l'identite, pre-remplir ce select

#### Segment

Le champ `Segment` doit rester court et comprehensible pour un utilisateur demo.

| Libelle UX | Valeur stockee | Usage |
|---|---|---|
| `Particulier` | `retail` | utilisateur final individuel |
| `Indépendant / TPE` | `micro_business` | activite individuelle ou tres petite structure |
| `PME` | `smb` | petite ou moyenne entreprise |
| `Grande entreprise` | `enterprise` | compte corporate ou grand compte |

Regle produit:

- champ optionnel, sans valeur par defaut
- masquer completement le champ si le segment n'apporte pas de valeur a la demo ciblee

#### Priorite

Le champ `Priorite` ne doit pas suggerer un workflow complexe.

| Libelle UX | Valeur stockee | Usage |
|---|---|---|
| `Standard` | `standard` | parcours normal |
| `Prioritaire` | `high` | traitement a mettre en avant |
| `Urgent` | `urgent` | cas a traiter au plus vite |

Regle produit:

- valeur par defaut: `standard`
- ne pas exposer de niveaux supplementaires au J1

### Libelles recommandes

- `Type de verification`
- `Reference client`
- `Pays`
- `Produit concerne`
- `Segment`
- `Priorite de traitement`

### Pourquoi ces champs

- `Type de verification` donne le contexte de routage le plus important
- `Reference client` remplace une saisie trop technique de `externalId`
- `Pays` et `Produit` donnent un contexte suffisant pour la plupart des demos
- `Priorite` reste utile sans faire entrer l'utilisateur dans la logique de compliance

## 3. Notifications

Ce bloc ne doit apparaitre que si sa presence apporte une vraie valeur au parcours.

### Champs retenus

| Libelle UX | Type | Regle | Mapping |
|---|---|---|---|
| `Email de notification` | email | optionnel | `notificationContext.email` |
| `Telephone de notification` | tel | optionnel | `notificationContext.phone` |
| `Canal prefere` | radio ou select | optionnel | `notificationContext.preferredChannel` |

### Valeurs exactes J1

| Libelle UX | Valeur stockee | Regle |
|---|---|---|
| `SMS` | `sms` | disponible seulement si un telephone valide est renseigne |
| `Email` | `email` | disponible seulement si un email valide est renseigne |
| `Push` | `push` | masque tant que l'app ne collecte pas de `pushToken` |
| `Aucun` | omission du champ | comportement par defaut si aucun canal n'est choisi |

### Regles UX

- pre-remplir si l'information existe deja
- ne pas imposer les deux champs email et telephone
- proposer `Aucun` ou laisser vide si aucune notification n'est souhaitee
- valider le format sans jargon technique
- ne jamais rendre le telephone obligatoire au J1

### Microcopy recommandee

- `Recevoir des notifications sur cette verification`
- `Choisissez le canal qui vous convient le mieux`

## 4. Options avancees

Ce bloc est replie par defaut.

### Ce qu'il contient

- ajout limite de paires cle/valeur
- apercu JSON genere en lecture seule

### Mapping

- les paires additionnelles vont dans `customContext`

### Garde-fous

- limiter a quelques entrees
- interdire les cles blacklistes
- interdire les structures imbriquees libres
- montrer un message simple si une cle est refusee

## Contextes techniques retenus par l'app

Le frontend doit utiliser prioritairement ces contexts:

- `notificationContext`
- `businessContext`
- `routingContext`
- `customContext`

Le frontend n'expose pas `complianceContext` au J1.

Raison:

- trop technique pour l'utilisateur cible
- risque de surcharger inutilement le parcours
- peu de valeur dans une app de demonstration simple

## Exemple de mapping complet

Reponses utilisateur:

- Scenario: `Onboarding`
- Reference client: `cust_0042`
- Pays: `SN`
- Produit: `Compte Premium`
- Email: `demo.user@example.com`
- Canal prefere: `email`
- Priorite: `standard`
- Cle avancee: `campaign = spring_demo`

Objet genere:

```json
{
  "metadataVersion": 1,
  "notificationContext": {
    "email": "demo.user@example.com",
    "preferredChannel": "email"
  },
  "businessContext": {
    "customerId": "cust_0042",
    "country": "SN",
    "product": "Compte Premium"
  },
  "routingContext": {
    "journey": "onboarding",
    "priority": "standard"
  },
  "customContext": {
    "campaign": "spring_demo"
  }
}
```

## Regles de contenu

Le formulaire doit:

- favoriser les listes de choix quand elles evitent des erreurs
- garder le texte libre pour les quelques champs qui le justifient
- proposer des exemples concrets dans les placeholders
- expliquer la valeur du champ plutot que son stockage

Le formulaire ne doit pas:

- demander `metadataVersion`
- demander `businessContext` ou `routingContext` comme tels
- exposer les limites 8 KB / 50 cles comme message principal
- encourager une saisie technique orientee backend

## Regle de derivation `Reference client` -> `externalId`

Au J1, l'utilisateur renseigne uniquement `Reference client`.

Le backend derive ensuite `externalId` avec la regle fermee dans [../DECISIONS-J1.md](../DECISIONS-J1.md).

Implication UX:

- ne jamais afficher `externalId` comme champ utilisateur
- expliquer `Reference client` comme l'identifiant metier de la demande

## Champs obligatoires recommandes au J1

- `Type de verification`
- `Reference client`

Tous les autres champs restent optionnels.

## Champs pre-remplissables

Si l'identite ou le compte demo fournissent deja des donnees fiables, l'app peut pre-remplir:

- email
- telephone
- pays
- produit par defaut

## Listes figees a implementer au J1

Les composants frontend doivent partir de ces enums locales:

```ts
const VERIFICATION_TYPE_OPTIONS = [
  { label: "Onboarding", value: "onboarding" },
  { label: "Mise a jour dossier", value: "profile_update" },
  { label: "Verification ponctuelle", value: "one_off_check" },
  { label: "Autre", value: "other" },
] as const;

const COUNTRY_OPTIONS = [
  { label: "Sénégal", value: "SN" },
  { label: "France", value: "FR" },
  { label: "États-Unis", value: "US" },
  { label: "Canada", value: "CA" },
  { label: "Royaume-Uni", value: "GB" },
  { label: "Allemagne", value: "DE" },
  { label: "Italie", value: "IT" },
  { label: "Espagne", value: "ES" },
  { label: "Suisse", value: "CH" },
  { label: "Belgique", value: "BE" },
  { label: "Maroc", value: "MA" },
  { label: "Algérie", value: "DZ" },
  { label: "Tunisie", value: "TN" },
  { label: "Côte d'Ivoire", value: "CI" },
  { label: "Autre", value: "OTHER" },
] as const;

const SEGMENT_OPTIONS = [
  { label: "Particulier", value: "retail" },
  { label: "Indépendant / TPE", value: "micro_business" },
  { label: "PME", value: "smb" },
  { label: "Grande entreprise", value: "enterprise" },
] as const;

const PRIORITY_OPTIONS = [
  { label: "Standard", value: "standard" },
  { label: "Prioritaire", value: "high" },
  { label: "Urgent", value: "urgent" },
] as const;

const PRODUCT_OPTIONS = [
  { label: "Compte Standard", value: "standard_account" },
  { label: "Compte Premium", value: "premium_account" },
  { label: "Prêt / Crédit", value: "credit" },
  { label: "Paiement / Wallet", value: "payments" },
  { label: "Autre", value: "other" },
] as const;

const NOTIFICATION_CHANNEL_OPTIONS = [
  { label: "SMS", value: "sms" },
  { label: "Email", value: "email" },
  { label: "Push", value: "push" },
] as const;
```

## Regle de longueur de `Reference client`

Au J1, la saisie utilisateur de `Reference client` est limitee a 128 caracteres avant normalisation.

## Proposition de CTA

- primaire: `Continuer`
- secondaire: `Retour`
- section avancee: `Afficher les options avancees`

## Decision UX retenue

La bonne approche pour whitelabel-vercel est:

- un ecran unique `SESSION_CONTEXT`
- des questions metier simples
- des presets de scenario
- une extension avancee discrete
- un mapping automatique vers les contexts backend