# Canon UI/UX local

Ce document definit directement dans whitelabel-vercel le langage esthetique et UX a conserver.

Objectif:

- garder la meme signature visuelle que integration-node
- ne pas dependre de integration-node pour les styles ou composants
- pouvoir reconstruire le design integralement depuis ce projet seul

## Direction visuelle

Le projet conserve une interface de confiance, legere et claire:

- palette claire dominante
- bleu de confiance comme couleur de marque principale
- cartes blanches sur fonds tres legers
- bordures discretes de type slate
- animations courtes et sobres
- densite mobile-first, parcours guide et rassurant

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

Pour l'authentification J1, cette logique s'applique aussi au formulaire de connexion direct:

- carte unique et centree
- etats inline pour login, nouveau mot de passe et reset
- message de restauration de session visible avant l'affichage complet du formulaire
- action secondaire de deconnexion gardee sobre sur les ecrans proteges

## Regles d'implementation

- les styles doivent etre redefinis localement dans whitelabel-vercel
- un composant repris de integration-node doit etre copie puis maintenu localement
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