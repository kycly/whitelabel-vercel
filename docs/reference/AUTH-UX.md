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

## Etats a prevoir

- etat neutre
- etat de verification d'une session Cognito existante
- etat d'erreur de retour d'auth
- etat `NEW_PASSWORD_REQUIRED`
- etat `FORGOT_PASSWORD`

## Decision technique J1

L'app authentifie directement l'utilisateur contre Cognito depuis le navigateur, puis envoie l'id token a une route serveur qui verifie le JWT et etablit une session locale via cookie HTTP-only securise.

Implications UX:

- aucun token brut n'est affiche a l'utilisateur
- la reconnexion doit paraitre immediate si une session Cognito existe deja cote navigateur
- la deconnexion efface la session Cognito locale puis la session applicative

## Comportement recommande

### Cas normal

1. l'utilisateur arrive sur `LOGIN`
2. il saisit ses identifiants Cognito
3. l'app verifie l'id token cote serveur
4. l'app passe en `AUTH_LOADING`

## Variables de configuration minimales

Le contrat J1 suppose au minimum:

- `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `NEXT_PUBLIC_AWS_REGION`

Le detail du contrat est ferme dans [../DECISIONS-J1.md](../DECISIONS-J1.md).

### Cas deja connecte

- si une session applicative valide existe deja, la route `LOGIN` redirige vers `AUTH_LOADING`
- si seule une session Cognito locale existe, la page tente de la restaurer puis bascule vers `AUTH_LOADING`

### Cas non autorise

- apres auth valide mais sans claim adequat, le parcours va vers `ACCESS_DENIED`

## Structure d'interface recommandee

```text
LOGIN PAGE
  Header brand
  Hero de confiance
  Carte de connexion
  Rappel securite / demo access
```

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