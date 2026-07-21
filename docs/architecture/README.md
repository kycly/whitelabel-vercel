# Architecture — whitelabel-vercel

**Statut** : Index architecture.
**Audience** : Architectes, développeurs.
**Lire d'abord** : [../BLUEPRINT.md](../BLUEPRINT.md).

Cette section documente les **flux de données vérifiés** et les **décisions architecturales** (ADR) de
`whitelabel-vercel`.

## Data-flows

| Flux | Objet |
|---|---|
| [data-flows/direct-cognito-auth.md](data-flows/direct-cognito-auth.md) | Login Cognito direct, vérification serveur, cookie HTTP-only |
| [data-flows/kyc-session-create.md](data-flows/kyc-session-create.md) | Création de session KYC (proxy `partner-node`) et lecture résultat |

## Décisions (ADR)

Voir l'index [decisions/README.md](decisions/README.md). Gabarit : [decisions/TEMPLATE.md](decisions/TEMPLATE.md).

## Voir aussi

- Cadrage : [../BLUEPRINT.md](../BLUEPRINT.md), [../DECISIONS-J1.md](../DECISIONS-J1.md), [../PARCOURS-J1.md](../PARCOURS-J1.md)
- Runbooks : [../runbooks/README.md](../runbooks/README.md)
- Référence : [../reference/README.md](../reference/README.md)
