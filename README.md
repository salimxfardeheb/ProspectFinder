# ProspectFinder

Un assistant intelligent de prospection qui identifie, analyse et classe automatiquement les entreprises ayant le plus fort potentiel de devenir clientes pour des prestations de création ou de refonte de sites web.

## Architecture

Monorepo pnpm + Turborepo :

```
prospect-finder/
├── apps/
│   ├── web/        # Frontend Next.js (port 3000) — Tailwind CSS v4 + shadcn/ui
│   └── api/        # Backend NestJS (port 3001) — Prisma + PostgreSQL
├── packages/       # Packages partagés (vide pour l'instant)
├── turbo.json      # Orchestration des tâches (build, dev, lint, check-types)
├── pnpm-workspace.yaml
├── eslint.config.mjs   # ESLint centralisé (flat config)
└── .prettierrc         # Prettier centralisé
```

## Prérequis

- Node.js >= 20
- pnpm (version figée dans `packageManager` du `package.json`)
- PostgreSQL (pour Prisma, quand des modèles seront définis)

## Démarrage

```bash
pnpm install

# Configurer l'environnement de l'API
cp apps/api/.env.example apps/api/.env

# Lancer web (3000) + api (3001) en parallèle
pnpm dev
```

## Scripts

| Commande            | Description                                    |
| ------------------- | ---------------------------------------------- |
| `pnpm dev`          | Démarre web + api en mode développement        |
| `pnpm build`        | Build de toutes les apps (avec cache Turbo)    |
| `pnpm lint`         | ESLint sur tous les workspaces                 |
| `pnpm check-types`  | Vérification TypeScript (`tsc --noEmit`)       |
| `pnpm format`       | Formate tout le repo avec Prettier             |
| `pnpm format:check` | Vérifie le formatage sans modifier             |

## Stack

- **TypeScript** partout, mode strict
- **Next.js 16** (App Router, React 19) + **Tailwind CSS v4** + **shadcn/ui**
- **NestJS 11** + **Prisma 7** (PostgreSQL)
- **pnpm workspaces** + **Turborepo** (cache de tâches)
- **ESLint 10** (flat config) + **Prettier** centralisés à la racine
