# UX page de connexion

Ce document fixe la page de connexion du scaffold.

La regle produit est simple:

- la connexion existe comme vraie page
- elle n'est pas remplacee par un ecran technique de chargement
- elle ouvre l'authentification Cognito sans exposer de details IAM inutiles

## Role de la page

La page `LOGIN` a trois objectifs:

- expliquer clairement a quoi sert l'application
- indiquer qu'un compte demo actif est requis
- lancer la connexion Cognito de maniere simple

## Position dans le parcours

```text
Utilisateur non connecte
  -> LOGIN
  -> Cognito Hosted UI
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
- aide secondaire: `Vous serez redirige vers la connexion securisee.`

### Bloc confiance

- point 1: `Connexion securisee via Cognito`
- point 2: `Verification disponible uniquement pour les comptes autorises`
- point 3: `Aucune cle API exposee dans votre navigateur`

## Ce qu'on ne fait pas au J1

- pas de formulaire local email / mot de passe
- pas d'inscription libre
- pas de reset password dans cette app si Cognito hosted UI le gere deja
- pas de murs de texte sur la securite

## Microcopy recommandee

### Titre

- `Connectez-vous pour lancer une verification`

### Sous-texte

- `Utilisez votre compte demo pour acceder au parcours de verification.`

### CTA principal

- `Se connecter`

### Message si retour d'erreur d'auth

- `La connexion n'a pas pu etre finalisee. Reessayez.`

## Regles UX

- une seule action principale visible au-dessus de la ligne de flottaison
- pas de jargon IAM ou JWT
- pas d'informations de compte tant que l'utilisateur n'est pas authentifie
- conserver le meme langage visuel que le reste du scaffold
- mobile-first, carte de connexion centree, contenu simple

## Etats a prevoir

- etat neutre
- etat de redirection vers Cognito
- etat d'erreur de retour d'auth

## Decision technique J1

Au retour de Cognito Hosted UI, l'app etablit une session locale via cookie HTTP-only securise.

Implications UX:

- aucun token brut n'est affiche ni manipule dans le navigateur
- la reconnexion doit paraitre immediate apres callback
- la deconnexion supprime d'abord la session locale puis termine le logout Cognito

## Comportement recommande

### Cas normal

1. l'utilisateur arrive sur `LOGIN`
2. il clique sur `Se connecter`
3. l'app redirige vers Cognito hosted UI
4. au retour, l'app passe en `AUTH_LOADING`

## Variables de configuration minimales

Le contrat J1 suppose au minimum:

- `NEXT_PUBLIC_COGNITO_DOMAIN`
- `NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN`
- `NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT`
- `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`

Le detail du contrat est ferme dans [../DECISIONS-J1.md](../DECISIONS-J1.md).

### Cas deja connecte

- si une session valide existe deja, la route `LOGIN` peut rediriger directement vers `AUTH_LOADING`

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

La page de connexion du J1 est une page simple, rassurante et orientee action, avec un seul CTA vers Cognito hosted UI. Elle existe comme surface produit a part entiere, distincte de `AUTH_LOADING`.