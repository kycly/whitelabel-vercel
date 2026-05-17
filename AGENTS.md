# AGENTS.md — whitelabel-vercel

Prompt principal du scaffold whitelabel-vercel.

Ce dossier porte une application dediee, separee de partner-node pour le runtime, mais reutilisant le meme user pool Cognito pour l'authentification des utilisateurs provisionnes en amont.

Ordre de lecture recommande:

1. [README.md](README.md)
2. [docs/BLUEPRINT.md](docs/BLUEPRINT.md)
3. [docs/DECISIONS-J1.md](docs/DECISIONS-J1.md)
4. [docs/PARCOURS-J1.md](docs/PARCOURS-J1.md)
5. [docs/runbooks/cicd-workflow.md](docs/runbooks/cicd-workflow.md)
6. [docs/reference/AUTH-UX.md](docs/reference/AUTH-UX.md)
7. [docs/reference/SESSION-CONTEXT-UX.md](docs/reference/SESSION-CONTEXT-UX.md)
8. [docs/reference/UI-ESTHETIC-CANON.md](docs/reference/UI-ESTHETIC-CANON.md)
9. [docs/reference/KYCLINK-SDK-INTEGRATION.md](docs/reference/KYCLINK-SDK-INTEGRATION.md)

## Invariants a respecter

- meme user pool Cognito que partner-node
- app client Cognito dedie a whitelabel-vercel
- portee metier sandbox-only au J1, y compris quand l'app est deployee sur Vercel preview ou Vercel production
- JWT Cognito pour l'auth utilisateur
- ck_demo_* uniquement cote serveur pour creer les sessions
- aucun acces direct a la base de partner-node
- dependance de service a partner-node au J1 pour creer les sessions KYC
- aucun secret expose au navigateur
- pas de base dediee au J1
- garder le meme langage esthetique UI/UX que integration-node, mais recopier et definir les tokens, animations, layouts et composants dans whitelabel-vercel

## Role du projet

Le projet fournit une application simple permettant a un utilisateur deja provisionne dans Cognito de:

1. se connecter
2. etre autorise selon ses claims Cognito
3. creer une session KYC pour son compte demo
4. lancer @kycly/link

## Frontieres

- partner-node reste responsable du provisioning utilisateurs en amont
- partner-node sandbox reste le service KYC canonique utilise au J1 pour la creation et la lecture des sessions
- whitelabel-vercel reste responsable de son runtime, de son deploiement, de son UX et de sa logique d'orchestration
- Cognito est la seule ressource partagee retenue au J1
- integration-node peut servir de reference de depart pour l'esthetique, mais aucun style, composant ou token ne doit etre consomme depuis ce projet au runtime

## Canon UI/UX

- definir les tokens visuels directement dans le projet
- garder une base Tailwind v4 avec theme CSS local
- reprendre le meme ton visuel que integration-node: trust blue, surfaces claires, cartes blanches, bordures slate, animations sobres
- conserver une architecture ecrans + layout wrappers + composants UI presentationnels
- si un composant ou un style est repris de integration-node, le copier puis le maintenir localement ici

## Deploiement cible

- projet Vercel dedie
- environnements Vercel dedies preview / production
- GitHub Environments dedies
- secrets dedies a cette app
- workflow de reference documente dans [docs/runbooks/cicd-workflow.md](docs/runbooks/cicd-workflow.md)
- ces environnements de deploiement ne changent pas la portee metier retenue: l'app reste branchee sur le runtime sandbox de partner-node tant qu'une decision explicite n'ouvre pas un mode prod distinct

## Si vous modifiez ce scaffold

- garder le runtime autonome
- refuser toute introduction d'acces direct a la base partner-node
- refuser toute creation de session cote client
- refuser toute introduction de `ck_live_*` dans cette app tant que le cadrage reste demo / sandbox-only
- pour une future liste utilisateur des verifications, preferer un proxy serveur vers `partner-node /kyclink/sessions` plutot qu'une persistance locale dediee
- documenter toute evolution qui ajoute de la persistance ou une dependance externe nouvelle
- refuser tout import cross-project de styles, composants ou tokens depuis integration-node
