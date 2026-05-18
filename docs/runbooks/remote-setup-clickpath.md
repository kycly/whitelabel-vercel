# Runbook — Procedure ecran par ecran GitHub et Vercel

Procedure d'execution concrete pour appliquer la configuration distante de `whitelabel-vercel` sans ambiguite.

Contexte reel retenu pour cette procedure:

- le repository GitHub vit dans une organisation
- le projet Vercel est porte par un compte personnel, pas par une team Vercel

Ce document ne remplace pas les runbooks de reference. Il les execute dans l'ordre:

- [cicd-workflow.md](cicd-workflow.md)
- [env-vars-lifecycle.md](env-vars-lifecycle.md)
- [repository-governance-setup.md](repository-governance-setup.md)

---

## Ordre d'execution retenu

Executer les ecrans dans cet ordre:

1. GitHub Environments
2. GitHub Branch Protection pour `main`
3. GitHub Branch Protection pour `production`
4. Vercel import du projet
5. Vercel variables `Preview`
6. Vercel variables `Production`
7. verification finale sur PR puis promotion

Cet ordre evite de creer une PR qui passe sans gouvernance ou une preview Vercel qui manque de variables.

---

## Prerequis avant ouverture des consoles

Preparer les informations suivantes:

- le repository GitHub cible
- un `GH_PACKAGES_TOKEN` avec scope `read:packages`
- un `NODE_AUTH_TOKEN` valable pour GitHub Packages cote Vercel
- les valeurs Cognito publiques de `whitelabel-vercel`
- une valeur `APP_SESSION_SECRET` pour `Preview`
- une valeur `APP_SESSION_SECRET` distincte pour `Production`
- `KYCLY_API_BASE_URL` du runtime `partner-node sandbox` pour `POST /kyclink/create` et `GET /kyclink/:sessionId/result`
- `KYCLY_SESSION_BASE_URL` du host exposant `GET /kyclink/sessions`, ou vide pour replier sur `KYCLY_API_BASE_URL`
- `KYCLY_ME_BASE_URL` du host exposant `/demo/me`
- le theme par defaut si override necessaire

Ne pas ouvrir Vercel avant d'avoir la liste de variables complete.

Impact pratique de ce contexte:

- cote GitHub, certaines options peuvent etre influencees par les policies de l'organisation ou exposees via `Rulesets` au lieu de simples `Branch protection rules`
- cote Vercel, ne pas chercher des ecrans de gouvernance d'organisation ou de team: la configuration se fait dans le projet du compte personnel

---

## GitHub — creer l'environnement `vercel-preview`

Chemin ecran:

1. ouvrir le repository GitHub
2. aller dans `Settings`
3. ouvrir `Environments`
4. cliquer `New environment`
5. saisir `vercel-preview`
6. cliquer `Configure environment`

Dans l'ecran `vercel-preview`:

1. section `Environment secrets`
2. cliquer `Add environment secret`
3. nom: `GH_PACKAGES_TOKEN`
4. valeur: PAT lecture seule `read:packages`
5. sauvegarder

Reglage retenu:

- ne pas ajouter d'approbation manuelle obligatoire a ce stade

Verification attendue:

- l'environnement `vercel-preview` apparait dans la liste
- le secret `GH_PACKAGES_TOKEN` est visible comme present

---

## GitHub — creer l'environnement `vercel-production`

Chemin ecran:

1. rester dans `Settings > Environments`
2. cliquer `New environment`
3. saisir `vercel-production`
4. cliquer `Configure environment`

Dans l'ecran `vercel-production`:

1. section `Environment secrets`
2. cliquer `Add environment secret`
3. nom: `GH_PACKAGES_TOKEN`
4. valeur: PAT lecture seule `read:packages`
5. sauvegarder

Reglage recommande:

- si vous attachez plus tard des jobs sensibles a cet environnement, ajouter une approbation requise

Verification attendue:

- l'environnement `vercel-production` apparait dans la liste
- le secret `GH_PACKAGES_TOKEN` est present

---

## GitHub — proteger la branche `main`

Note organisation GitHub:

- selon le plan ou les policies de l'organisation, l'ecran peut proposer `Rulesets` a la place de `Branch protection rules`
- si un ruleset d'organisation existe deja et cible `main`, il faut le completer ou le verifier au lieu de creer une regle concurrente au niveau du repository

Chemin ecran:

1. ouvrir `Settings`
2. ouvrir `Branches` ou `Rules`
3. ouvrir `Branch protection rules` ou `Rulesets` selon l'interface disponible
4. creer ou editer la regle qui cible `main`

Remplir l'ecran ainsi:

- `Branch name pattern`: `main`
- activer `Require a pull request before merging`
- activer `Require approvals`
- valeur minimale: `1`
- activer `Dismiss stale pull request approvals when new commits are pushed`
- activer `Require conversation resolution before merging`
- activer `Require status checks to pass before merging`
- dans la liste des checks requis, selectionner `quality`
- activer `Require branches to be up to date before merging`
- desactiver le push direct si l'option est proposee par votre plan GitHub
- desactiver `Allow force pushes`
- desactiver `Allow deletions`

Si l'ecran propose les modes de merge au niveau repository:

1. aller dans `Settings > General`
2. section `Pull Requests`
3. laisser `Allow squash merging` actif
4. desactiver `Allow merge commits` si vous voulez une promotion stricte
5. laisser `Allow rebase merging` selon votre preference d'equipe

Verification attendue:

- la regle ou le ruleset `main` apparait dans l'interface de gouvernance GitHub
- le status check `quality` figure dans les checks obligatoires

---

## GitHub — proteger la branche `production`

Note organisation GitHub:

- le meme principe s'applique ici: si l'organisation force deja des rulesets, les modifier au bon niveau au lieu d'empiler une regle locale contradictoire

Chemin ecran:

1. toujours dans `Settings > Branches` ou `Settings > Rules`
2. ouvrir `Branch protection rules` ou `Rulesets`
3. creer ou editer la regle qui cible `production`

Remplir l'ecran ainsi:

- `Branch name pattern`: `production`
- activer `Require a pull request before merging`
- activer `Require approvals`
- valeur minimale: `1`
- activer `Require conversation resolution before merging`
- activer `Require status checks to pass before merging`
- selectionner `quality`
- activer `Require branches to be up to date before merging`
- interdire le push direct si l'option est proposee
- desactiver `Allow force pushes`
- desactiver `Allow deletions`

Si GitHub permet de restreindre les acteurs autorises:

- limiter le merge a la liste restreinte des maintainers

Verification attendue:

- la regle ou le ruleset `production` apparait dans l'interface de gouvernance GitHub
- `quality` est exige sur `production`
- aucun push direct n'est possible

---

## Vercel — importer le projet

Note compte personnel Vercel:

- l'import se fait dans votre espace personnel Vercel
- ne pas chercher d'ecran `Team Settings` ou de scopes de team si votre compte n'en a pas
- les variables et reglages seront geres au niveau du projet personnel

Chemin ecran:

1. ouvrir Vercel
2. cliquer `Add New...`
3. cliquer `Project`
4. selectionner le provider GitHub
5. choisir le repository qui contient `whitelabel-vercel`
6. cliquer `Import`

Dans l'ecran de configuration du projet:

- `Framework Preset`: `Next.js`
- `Root Directory`: `whitelabel-vercel`
- `Build and Output Settings` si personnalisation necessaire
- `Install Command`: `pnpm install --frozen-lockfile`
- `Build Command`: `pnpm build`

Ne pas lancer le deploiement final tant que les variables ne sont pas chargees si Vercel les exige deja a la creation.

Verification attendue:

- le projet est cree
- le root directory affiche `whitelabel-vercel`
- le preset affiche `Next.js`
- le projet apparait dans l'espace personnel Vercel attendu

---

## Vercel — definir la branche de production

Note compte personnel Vercel:

- ce reglage est dans les `Project Settings` du projet personnel
- il n'y a pas de couche supplementaire de gouvernance team a parametrer ici

Chemin ecran:

1. ouvrir le projet Vercel
2. aller dans `Settings`
3. ouvrir `Git`
4. trouver `Production Branch`
5. remplacer la valeur par `production` si necessaire
6. sauvegarder

Verification attendue:

- `Production Branch` vaut `production`

---

## Vercel — charger les variables `Preview`

Note compte personnel Vercel:

- les variables sont definies directement dans le projet personnel
- ne pas chercher un magasin de secrets d'organisation Vercel si vous n'utilisez pas de team

Chemin ecran:

1. dans le projet Vercel, ouvrir `Settings`
2. ouvrir `Environment Variables`
3. ajouter chaque variable avec la cible `Preview`

Saisir au minimum:

- `NEXT_PUBLIC_APP_ENV=preview`
- `NEXT_PUBLIC_AWS_REGION`
- `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `APP_SESSION_SECRET`
- `NODE_AUTH_TOKEN`
- `KYCLY_API_BASE_URL`
- `KYCLY_ME_BASE_URL`
- `DEFAULT_KYCLINK_THEME` si necessaire

Controles obligatoires avant sauvegarde:

- `NEXT_PUBLIC_COGNITO_USER_POOL_ID` et `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID` correspondent bien au client Cognito dedie
- `NODE_AUTH_TOKEN` est present pour permettre l'installation de `@kycly/link` via GitHub Packages pendant le build Vercel
- `KYCLY_API_BASE_URL` pointe vers `partner-node sandbox`
- `KYCLY_ME_BASE_URL` pointe vers l'hote exposant `/demo/me`
- aucune ancienne variable de mapping demo n'est definie

Verification attendue:

- toutes les variables apparaissent avec la cible `Preview`

---

## Vercel — charger les variables `Production`

Note compte personnel Vercel:

- meme principe que pour `Preview`: tout se passe dans les variables du projet personnel

Chemin ecran:

1. rester dans `Settings > Environment Variables`
2. ajouter chaque variable avec la cible `Production`

Saisir au minimum:

- `NEXT_PUBLIC_APP_ENV=production`
- `NEXT_PUBLIC_AWS_REGION`
- `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `APP_SESSION_SECRET`
- `NODE_AUTH_TOKEN`
- `KYCLY_API_BASE_URL`
- `KYCLY_ME_BASE_URL`
- `DEFAULT_KYCLINK_THEME` si necessaire

Controles obligatoires avant sauvegarde:

- `APP_SESSION_SECRET` doit etre different de celui de `Preview`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID` et `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID` correspondent bien au client Cognito dedie
- `NODE_AUTH_TOKEN` est present pour permettre l'installation de `@kycly/link` via GitHub Packages pendant le build Vercel
- `KYCLY_API_BASE_URL` pointe encore vers `partner-node sandbox`
- `KYCLY_ME_BASE_URL` pointe encore vers l'hote exposant `/demo/me`
- aucune ancienne variable de mapping demo n'est definie

Verification attendue:

- toutes les variables apparaissent avec la cible `Production`

---

## Vercel — verifier le comportement preview

Chemin ecran:

1. ouvrir `Settings`
2. ouvrir `Git`
3. verifier que les previews sont actives
4. verifier que le repository est bien connecte

Verification attendue:

- une pull request genere un deploiement preview
- une branche hors `production` genere un deploiement preview si le projet est configure ainsi

---

## Verification finale GitHub sur une PR vers `main`

Sequence:

1. creer une branche de travail
2. ouvrir une PR vers `main`
3. verifier l'apparition du template de PR
4. remplir les sections du template
5. attendre le workflow `ci`
6. verifier que le check `quality` passe
7. verifier que la preview Vercel est attachee a la PR

Resultat attendu:

- merge impossible tant que `quality` n'est pas vert
- preview Vercel consultable depuis la PR

---

## Verification finale de promotion vers `production`

Sequence:

1. ouvrir une PR vers `production`
2. verifier que `quality` repart aussi sur cette PR
3. merger seulement apres validation intentionnelle
4. ouvrir Vercel et verifier le deploiement `Production`
5. controler le login
6. controler la creation de session KYC
7. controler la lecture de session et la liste de sessions

Resultat attendu:

- le deploiement `Production` est publie depuis la branche `production`
- l'application reste branchee sur `partner-node sandbox`
- aucune cle `ck_live_*` n'est impliquee

---

## Erreurs a detecter immediatement

Bloquer la mise en place si vous observez l'un de ces symptomes:

- `quality` n'apparait pas dans la liste des checks requis
- le root directory Vercel n'est pas `whitelabel-vercel`
- Vercel propose `main` comme branche de production et la valeur n'est pas corrigee
- l'URL Cognito preview ou production ne correspond pas aux variables Vercel
- `KYCLY_API_BASE_URL` vise autre chose que `partner-node sandbox`
- `KYCLY_ME_BASE_URL` ne vise pas l'hote expose pour `/demo/me`
- une ancienne variable de mapping demo est encore renseignee

---

## Decision finale retenue

La mise en place distante doit etre executee exactement dans cet ordre:

1. GitHub Environments
2. Branch protections
3. import Vercel
4. branche de production Vercel
5. variables `Preview`
6. variables `Production`
7. verification PR puis promotion

Ce document est le mode operatoire a suivre ecran par ecran.