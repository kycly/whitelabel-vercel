# Canon UI/UX local

Ce document definit directement dans whitelabel-vercel le langage esthetique et UX a conserver.

Objectif:

- recopier localement les memes codes esthetiques que integration-node
- ne pas dependre de integration-node pour les styles ou composants
- pouvoir reconstruire le design integralement depuis ce projet seul

## Direction visuelle

Le projet conserve une interface de confiance, legere et claire, identique dans ses codes a integration-node:

- frame mobile centree sur desktop, plein ecran sur mobile
- palette claire dominante
- bleu de confiance comme couleur de marque principale
- cartes `surface-light` avec controles blancs internes
- bordures discretes de type slate
- animations courtes et sobres
- densite mobile-first, parcours guide et rassurant

Principe de sobriete a conserver:

- une page de parcours = un bloc principal
- un bloc principal = une intention unique
- une action principale visible par ecran
- pas de panneaux lateraux persistants pour rappeler des informations deja connues

## Tokens visuels

Ces tokens doivent exister localement dans la feuille de style globale du projet.

```css
@import "tailwindcss";

@theme inline {
  --font-sans: "Inter", system-ui, sans-serif;

  --color-brand: var(--brand-primary);
  --color-brand-foreground: var(--brand-foreground);

  --color-surface-light: var(--surface-light);
  --color-surface-card: var(--surface-card);

  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-background: var(--background);
  --color-foreground: var(--foreground);

  --shadow-soft: 0 10px 40px -10px rgba(0, 0, 0, 0.08);
  --shadow-card: 0 4px 16px -4px rgba(0, 0, 0, 0.06);
}

:root {
  --background: #ffffff;
  --foreground: #0f172a;
  --border: #e2e8f0;

  --brand-primary: #2563eb;
  --brand-foreground: #ffffff;

  --surface-light: #f1f5f9;
  --surface-card: #ffffff;

  --muted-foreground: #64748b;
}
```

## Typographie

- police sans-serif principale: Inter
- rendu net et simple, sans empilement decoratif
- hierarchie visuelle basee sur contraste, graisse et espace, pas sur effets lourds

## Animations

Les animations du projet doivent rester minimales, lisibles et coherentes.

```css
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes scale-in {
  from { opacity: 0; transform: scale(0.85); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}

.animate-fade-in { animation: fade-in 0.3s ease both; }
.animate-slide-up { animation: slide-up 0.35s ease both; }
.animate-scale-in { animation: scale-in 0.2s ease both; }
.animate-shake { animation: shake 0.4s ease; }
```

## Structure UI

La structure a conserver est la suivante:

- ecrans stateful pour les etapes du parcours
- composants UI presentationnels pour les briques reutilisables
- layout wrappers pour le cadre mobile-like, l'entete et les transitions
- backend et logique d'auth hors composants presentationnels

Structure cible:

```text
src/
  components/
    screens/
    layout/
    ui/
```

## Codes UX a conserver

- parcours guide ecran par ecran
- call-to-action principal unique et lisible par ecran
- chargements explicites et rassurants
- erreurs visibles mais sobres
- formulation orientee confiance et accompagnement
- densite adaptee mobile avant desktop
- header compact type wizard avec titre centre
- deconnexion en haut a droite sur les ecrans proteges

Pour les ecrans proteges du parcours KYC, la sequence cible est maintenant:

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
- `SESSION_CONTEXT`, `SESSION_PREPARE`, `COMPLETE` et `SESSIONS` utilisent une icone retour avec fallback explicite par etape, sans dependre uniquement de l'historique navigateur
- l'icone retour de `COMPLETE` renvoie vers `SESSIONS`
- les ecrans proteges conservent aussi une deconnexion iconique en haut a droite
- les labels editoriaux de type `WELCOME`, `COMPLETE`, `SESSIONS` ou `KYC_LINK` ne doivent pas etre affiches comme titres d'ecran

Pour l'authentification J1, cette logique s'applique aussi au formulaire de connexion direct:

- carte unique et centree
- etats inline pour login, nouveau mot de passe et reset
- message de restauration de session visible avant l'affichage complet du formulaire
- action secondaire de deconnexion gardee sobre sur les ecrans proteges
- hero centre avec icone principale et accent de confiance

## Regles specifiques `SESSION_CONTEXT`

L'ecran `SESSION_CONTEXT` doit etre encore plus minimal que les autres etapes du parcours.

Regles visuelles et UX a conserver:

- pas de label editorial de type `SESSION_CONTEXT` au-dessus du formulaire
- pas de grand titre descriptif ni de texte d'introduction long
- pas de bouton de deconnexion visible dans le bloc principal
- hero centre puis carte `surface-light`, dans le meme vocabulaire que integration-node
- deux champs visibles par defaut seulement: `External ID` et `Notification SMS`
- tous les autres champs sont ajoutes explicitement par l'utilisateur via une checklist `Besoins optionnels`
- les ajouts sont regroupes par contextes `Contexte metier`, `Contexte routage`, `Email` et `Contexte libre`
- les champs optionnels apparaissent inline dans le meme panneau, avec suppression discrete par groupe ou par paire libre
- un seul CTA principal visible en bas du bloc, fixe et stable en hauteur (`h-14`)

## Regles specifiques autres ecrans proteges

- `WELCOME` ne montre que l'identite utile et les actions principales, sans details techniques de compte demo
- l'acces a l'historique de sessions doit etre visible directement dans le bloc principal de `WELCOME`, comme une action secondaire claire et non comme un simple lien de pied de page
- `SESSION_PREPARE` ne montre qu'un loader et une phrase courte
- `KYC_LINK` privilegie l'iframe et supprime les titres concurrents
- `COMPLETE` et `SESSIONS` gardent des actions courtes et des resumees lisibles, sans sur-explication
- `workflowStatus = null` est rendu cote UI comme `TRAIT. EN COURS`
- `SESSIONS` affiche en plus des raccourcis decisionnels clairs, compacts et secondaires: actualiser, reinitialiser les filtres, relancer une verification
- `SESSIONS` privilegie des actions utilitaires en icones avec `title`/`aria-label`, et reserve le texte plein au seul CTA primaire utile dans les etats vides
- dans une ligne de session, `Reprendre` n'apparait que si la session est incomplete et non expiree
- chaque ligne de session conserve aussi une action textuelle `Voir le résultat`
- `COMPLETE` privilegie aussi des actions utilitaires en icones avec `title`/`aria-label`, avec sortie positive explicite vers l'accueil quand disponible
- `ACCESS_DENIED` et `FAILURE` restent centrés sur un message unique et une sortie claire

## Regles d'implementation

- les styles doivent etre redefinis localement dans whitelabel-vercel
- un composant repris de integration-node doit etre copie puis maintenu localement
- `PageShell`, `SurfacePanel` et les ecrans proteges reprennent le meme frame mobile que integration-node
- les ecrans d'entree et de collecte reprennent les memes schemas visuels: hero centre, carte `surface-light`, inputs `h-14` arrondis, CTA plein bleu
- les primitives de layout fixe, CTA, champs, cartes et alertes sont centralisees dans `src/components/ui/fixed-action-layout.ts`
- ne pas importer de CSS, de composants ou de tokens depuis integration-node
- ne pas documenter le design comme une simple reference externe

## Stack UI recommandee

- Next.js App Router
- Tailwind CSS v4
- composants UI presentationnels locaux
- eventuelle base shadcn/ui si elle reste localisee au projet

## Criteres de revue

- la palette reste coherente avec le bleu de confiance et les surfaces claires
- les tokens existent localement dans le projet
- les layouts de parcours gardent la meme logique de guidage que integration-node
- aucune dependance cross-project n'est introduite pour les styles ou composants
- les ecrans principaux restent visuellement dans la meme famille que integration-node
- aucun ecran de parcours ne depasse un bloc principal concurrentiel
- aucun ecran ne melange formulaire, creation de session et iframe dans la meme vue