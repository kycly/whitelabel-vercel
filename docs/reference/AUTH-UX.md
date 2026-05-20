# UX page de connexion

Ce document fixe la page de connexion du scaffold.

La regle produit est simple:

- la connexion existe comme vraie page
- elle n'est pas remplacee par un ecran technique de chargement
- elle ouvre l'authentification Cognito sans exposer de details IAM inutiles
- elle collecte email et mot de passe directement dans l'app, comme partner-node

## Role de la page

La page `LOGIN` a quatre objectifs:

- expliquer clairement a quoi sert l'application
- indiquer qu'un compte demo actif est requis
- lancer la connexion Cognito de maniere simple
- permettre le nouveau mot de passe et le reset sans sortir de l'app

## Position dans le parcours

```text
Utilisateur non connecte
  -> LOGIN
  -> formulaire Cognito direct
  -> AUTH_LOADING
  -> WELCOME ou ACCESS_DENIED
```

Les ecrans `AUTH_LOADING` et `ACCESS_DENIED` doivent rester aussi sobres que `LOGIN`.

## Contenu recommande

La page reste volontairement legere.

### Hero principal

- titre: `Connectez-vous pour lancer une verification`
- sous-titre: `Accedez a votre espace demo securise et demarrez un parcours KYC en quelques etapes.`

### Carte de connexion

- rappel court: `Votre acces depend d'un compte demo deja active.`
- CTA principal: `Se connecter`
- aide secondaire: `La session Cognito est validee cote serveur avant ouverture de l'espace demo.`

### Bloc confiance

- point 1: `Connexion securisee via Cognito`
- point 2: `Verification disponible uniquement pour les comptes autorises`
- point 3: `Aucune cle API exposee dans votre navigateur`

## Ce qu'on ne fait pas au J1

- pas d'inscription libre
- pas de details IAM, JWT ou claims sur la page de connexion
- pas de murs de texte sur la securite

## Microcopy recommandee

### Titre

- `Connectez-vous pour lancer une verification`

### Sous-texte

- `Utilisez votre compte demo pour acceder au parcours de verification.`

### CTA principal

- `Se connecter`

### Message si erreur d'auth

- `La connexion n'a pas pu etre finalisee. Reessayez.`
- `Identifiant ou mot de passe invalide.`
- `Votre compte exige la definition d'un nouveau mot de passe.`

## Regles UX

- une seule action principale visible au-dessus de la ligne de flottaison
- pas de jargon IAM ou JWT
- pas d'informations de compte tant que l'utilisateur n'est pas authentifie
- conserver le meme langage visuel que le reste du scaffold
- mobile-first, carte de connexion centree, contenu simple
- reprendre le meme frame mobile et le meme hero que integration-node, mais dans une version plus compacte et moins demonstrative
- afficher une icone retour uniquement sur les sous-etapes du formulaire quand elle sert a revenir dans le flux local
- la deconnexion reste reservee aux ecrans proteges, pas a `LOGIN`
- conserver un header court avec separateur discret et ne jamais laisser le hero pousser le formulaire sous la ligne de flottaison mobile

## Etats a prevoir

- etat neutre
- etat de verification d'une session Cognito existante
- etat d'erreur de retour d'auth
- etat `NEW_PASSWORD_REQUIRED`
- etat `FORGOT_PASSWORD`

## Regles specifiques `AUTH_LOADING`

- pas de sur-titre editorial de type `AUTH_LOADING`
- pas de grand titre ni de texte explicatif long
- un seul indicateur de progression visible
- aucun detail technique sur la verification serveur ou le scope demo
- aucun bouton retour ni deconnexion concurrente dans le header
- carte compacte, centree, sans decor additionnel ni second CTA

## Regles specifiques `ACCESS_DENIED`

- un message unique et direct
- aucune explication technique sur les claims ou le scoping partner-node
- aucune navigation generique concurrente dans le header
- une seule sortie explicite de deconnexion dans le contenu
- ton produit calme, sans ecran d'erreur agressif ni hero inutile

## Decision de navigation

- l'etat initial de `LOGIN` n'affiche pas d'icone retour
- les sous-etapes `NEW_PASSWORD_REQUIRED` et `FORGOT_PASSWORD` repliquent d'abord vers l'etape precedente du formulaire
- `FORGOT_PASSWORD_CONFIRM` revient d'abord vers la demande de code
- `AUTH_LOADING` ne propose pas d'interruption manuelle de la transition
- les ecrans proteges racine ne replient jamais vers `LOGIN` pour eviter les boucles avec la restauration de session

## Decision technique J1

L'app authentifie directement l'utilisateur contre Cognito depuis le navigateur, puis envoie l'id token a une route serveur qui verifie le JWT et etablit une session locale via cookie HTTP-only securise.

La session applicative signee conserve cote serveur:

- `sub`
- `email`
- `name`
- `demoAccountId`
- `canAccess`
- l'id token Cognito, pour authentifier ensuite les appels serveur vers `partner-node /kyclink/*`

Implications UX:

- aucun token brut n'est affiche a l'utilisateur
- aucun token Cognito n'est expose via `GET /api/me`
- la reconnexion doit paraitre immediate si une session Cognito existe deja cote navigateur
- la deconnexion efface la session Cognito locale puis la session applicative

## Comportement recommande

### Cas normal

1. l'utilisateur arrive sur `LOGIN`
2. il saisit ses identifiants Cognito
3. l'app verifie l'id token cote serveur
4. l'app resout le scope demo via `partner-node /demo/me`
5. l'app passe en `AUTH_LOADING`

## Variables de configuration minimales

Le contrat J1 suppose au minimum:

- `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `NEXT_PUBLIC_AWS_REGION`
- `APP_SESSION_SECRET`
- `KYCLY_ME_BASE_URL`

Le detail du contrat est ferme dans [../DECISIONS-J1.md](../DECISIONS-J1.md).

### Cas deja connecte

- si une session applicative valide existe deja, la route `LOGIN` redirige vers `AUTH_LOADING`
- si seule une session Cognito locale existe, la page tente de la restaurer puis bascule vers `AUTH_LOADING`

### Cas non autorise

- apres auth valide mais sans scope demo resolu par partner-node, le parcours va vers `ACCESS_DENIED`

## Structure d'interface recommandee

```text
LOGIN PAGE
  Frame mobile integration-node
  Hero de confiance centre
  Carte de connexion surface-light
  CTA plein bleu en pied
```

## Canon visuel

- meme frame mobile que integration-node
- meme hero centre avec icone principale et accent securite
- meme vocabulaire de controles: champs hauts, arrondis, fond blanc, carte `surface-light`
- meme CTA principal bleu plein, largeur totale, ombre legere

## Donnees affichees

Avant auth, ne montrer que:

- le branding
- le message de valeur
- le fait qu'un compte demo est requis

Ne pas afficher:

- `demo_account_id`
- email attendu
- type de token
- details d'autorisation

## Decision UX retenue

La page de connexion du J1 est une page simple, rassurante et orientee action, avec un formulaire Cognito direct et des flux annexes limites a `NEW_PASSWORD_REQUIRED` et `FORGOT_PASSWORD`. Elle existe comme surface produit a part entiere, distincte de `AUTH_LOADING`.

Apres verification serveur de l'id token, l'app resout le scope demo via partner-node avant d'ouvrir l'espace protege.