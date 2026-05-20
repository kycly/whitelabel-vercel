# Canon UI/UX local

Ce document fixe le langage visuel et UX local de `whitelabel-vercel`.

Objectif:

- garder le meme langage esthetique que `integration-node`
- maintenir tokens, animations et composants localement
- eviter toute dependance runtime cross-project

## Direction visuelle

Le produit reste:

- clair, calme et guide
- mobile-first, plein ecran sur mobile et cadre centre sur desktop
- fonde sur un bleu de confiance, des surfaces claires et des bordures discretes
- sobre dans les animations et la densite

Directive non negociable:

- refuser tout rendu generique, interchangeable ou type template IA
- refuser les compositions de landing page SaaS ou de prototype no-code
- garder une identite specifique a un parcours de verification d'identite

## Tokens et animations

Le projet doit definir localement:

- la police principale `Inter`
- les tokens `--brand-primary`, `--surface-light`, `--surface-card`, `--border`, `--background`, `--foreground`, `--muted-foreground`
- les ombres `--shadow-soft` et `--shadow-card`
- les animations `fade-in`, `slide-up`, `scale-in`, `shake`

## Structure UI

Structure attendue:

- `src/components/screens` pour les ecrans stateful
- `src/components/layout` pour le shell et l'entete
- `src/components/ui` pour les primitives presentationnelles
- aucune logique backend ou auth dans les composants UI

## Contrat UX

- une page de parcours = un bloc principal
- une intention principale par ecran
- un CTA principal visible par ecran
- chargements explicites, erreurs visibles et ton rassurant
- header compact avec titre centre
- deconnexion seulement quand elle ne concurrence pas le CTA metier

Sequence protegee du parcours KYC:

1. `WELCOME`
2. `SESSION_CONTEXT`
3. `SESSION_PREPARE`
4. `KYC_LINK`
5. `COMPLETE`
6. `SESSIONS`

Regles specifiques:

- l'iframe KycLink vit sur une page dediee, jamais sur l'ecran de collecte
- l'ecran de preparation technique reste minimal et transitoire
- les ecrans `COMPLETE` et `SESSIONS` exposent seulement le statut, la reference utile, la decision observable et les actions de suite
- `WELCOME` n'affiche pas d'icone retour
- `KYC_LINK` n'affiche pas d'icone retour
- `KYC_LINK` n'affiche pas non plus d'action de deconnexion
- `SESSION_CONTEXT`, `SESSION_PREPARE`, `COMPLETE` et `SESSIONS` utilisent une icone retour a destination canonique par etape, sans dependre de l'historique navigateur
- l'icone retour de `COMPLETE` renvoie vers `SESSIONS`
- les ecrans proteges ne conservent une deconnexion iconique en haut a droite que lorsqu'elle reste utile au flux
- `KYC_LINK`, `AUTH_LOADING`, `FAILURE` et `ACCESS_DENIED` evitent les sorties generiques concurrentes dans le header
- les labels editoriaux de type `WELCOME`, `COMPLETE`, `SESSIONS` ou `KYC_LINK` ne doivent pas etre affiches comme titres d'ecran
- les ecrans proteges a contenu long ou a footer persistant verrouillent le viewport du shell et deleguent le defilement a un body interne dedie

Pour l'authentification, cette logique s'applique aussi au formulaire de connexion direct:

- carte unique et centree
- etats inline pour login, nouveau mot de passe et reset
- message de restauration de session visible avant l'affichage complet du formulaire
- action de deconnexion reservee aux ecrans ou elle ne concurrence pas un CTA metier plus clair
- hero centre avec icone principale et accent de confiance

## Regles specifiques `SESSION_CONTEXT`

L'ecran `SESSION_CONTEXT` est l'etape la plus minimale du parcours:

- pas de label editorial de type `SESSION_CONTEXT` au-dessus du formulaire
- pas de grand titre descriptif ni de texte d'introduction long
- pas de bouton de deconnexion visible dans le bloc principal
- hero centre puis carte `surface-light`, dans le meme vocabulaire que integration-node
- deux champs visibles par defaut seulement: `External ID` et `Notification SMS`
- `External ID` reste editable librement et propose une generation en un clic via une icone discrete, avec un format `KYCLY_` suivi de 8 caracteres lisibles
- tous les autres champs sont ajoutes explicitement par l'utilisateur via une checklist `Besoins optionnels`
- les ajouts sont regroupes par contextes `Contexte metier`, `Contexte routage`, `Email` et `Contexte libre`
- les champs optionnels apparaissent inline dans le meme panneau, avec suppression discrete par groupe ou par paire libre
- le document global reste fixe pendant cette etape; seul le body interne du formulaire peut defiler
- un seul CTA principal visible en bas du bloc, fixe et stable en hauteur (`h-14`)

## Regles specifiques autres ecrans proteges

- `WELCOME` ne montre que l'identite utile et les actions principales, sans details techniques de compte demo
- l'acces a l'historique de sessions doit etre visible directement dans le bloc principal de `WELCOME`, comme une action secondaire claire et non comme un simple lien de pied de page
- `SESSION_PREPARE` ne montre qu'un loader et une phrase courte
- `KYC_LINK` privilegie l'iframe et supprime les titres concurrents
- `COMPLETE` et `SESSIONS` gardent des actions courtes et des resumees lisibles, sans sur-explication
- `WELCOME`, `SESSIONS` et `COMPLETE` reutilisent le meme contrat: header fixe, body interne scrollable, actions separees du contenu principal
- `workflowStatus = null` est rendu cote UI comme `TRAIT. EN COURS`
- `SESSIONS` affiche en plus des raccourcis decisionnels clairs, compacts et secondaires: actualiser, reinitialiser les filtres, relancer une verification
- `SESSIONS` privilegie des actions utilitaires en icones avec `title`/`aria-label`, et reserve le texte plein au seul CTA primaire utile dans les etats vides
- dans une ligne de session, `Reprendre` n'apparait que si la session est incomplete et non expiree
- chaque ligne de session conserve aussi une action textuelle `Voir le résultat`
- `COMPLETE` privilegie aussi des actions utilitaires en icones avec `title`/`aria-label`, avec sortie positive explicite vers l'accueil quand disponible
- `ACCESS_DENIED` et `FAILURE` restent centrés sur un message unique et une sortie claire
- la microcopy visible doit rester propre en JSX React, y compris pour les apostrophes et textes editoriaux, afin d'eviter tout contournement de lint ou derive de rendu

## Regles d'implementation

- les styles doivent etre redefinis localement dans whitelabel-vercel
- un composant repris de integration-node doit etre copie puis maintenu localement
- `PageShell`, `SurfacePanel` et les ecrans proteges reprennent le meme frame mobile que integration-node
- `ProtectedScreenShell` porte le contrat de verrouillage optionnel du viewport pour les ecrans critiques; on ne repete pas des classes de scroll brutes dans chaque ecran
- les ecrans d'entree et de collecte reprennent les memes schemas visuels: hero centre, carte `surface-light`, inputs `h-14` arrondis, CTA plein bleu
- les primitives de layout fixe, CTA, champs, cartes et alertes sont centralisees dans `src/components/ui/fixed-action-layout.ts`, y compris la variante footer avec safe-area
- ne pas importer de CSS, de composants ou de tokens depuis integration-node
- ne pas documenter le design comme une simple reference externe

## Criteres de revue

- la palette reste coherente avec le bleu de confiance et les surfaces claires
- les tokens existent localement dans le projet
- les layouts de parcours gardent la meme logique de guidage que integration-node
- aucune dependance cross-project n'est introduite pour les styles ou composants
- les ecrans principaux restent visuellement dans la meme famille que integration-node
- aucun ecran de parcours ne depasse un bloc principal concurrentiel
- aucun ecran ne melange formulaire, creation de session et iframe dans la meme vue
- aucun ecran ne doit donner l'impression d'un template visuel generique ou d'un rendu “AI-first” depersonnalise