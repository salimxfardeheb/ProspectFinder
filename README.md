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

## Cache des appels Google (développement)

Chaque recherche coûte de l'argent (voir tarifs Google Places/Geocoding). Pour ne payer
qu'une fois par scénario testé, l'API met automatiquement en cache chaque appel Google
distinct dans `apps/api/fixtures/google-api/` (fichiers JSON versionnés dans git) :

- **1er appel** pour une combinaison donnée (une ville à géocoder, ou un mot-clé + une
  cellule lat/lng/rayon) → vrai appel Google, réponse sauvegardée dans un fichier.
- **Tout appel identique ensuite** (même ville, même mot-clé, même cellule) → relu depuis
  le fichier, 0 requête réseau, 0 coût. C'est transparent : rien à activer, il suffit de
  relancer la même recherche.
- Le géocodage est mis en cache par ville seule (indépendamment du mot-clé) : chercher
  "restaurant", puis "hôtel", puis "dentiste" à Oran ne géocode Oran qu'une seule fois.
- La recherche en grille (`grid-engine`) met en cache **chaque cellule individuellement** :
  changer un mot-clé ou une ville déclenche de nouveaux appels réels pour les nouvelles
  cellules, mais relancer la même recherche pour affiner la logique de dédoublonnage,
  l'affichage ou les statistiques ne coûte plus jamais rien.
- Pour forcer un nouvel appel réel sur un scénario précis : supprimer le fichier
  correspondant dans `apps/api/fixtures/google-api/`.
- Pour désactiver totalement le cache : `GOOGLE_API_CACHE=false` dans `apps/api/.env`.

⚠️ **Ne jamais laisser le cache activé en production** — un vrai utilisateur ne doit
jamais recevoir un résultat rejoué et potentiellement obsolète.

## Mode de recherche "Development" (peu d'appels Google)

`POST /search` peut s'appuyer sur deux stratégies (`SEARCH_STRATEGY_MODE` dans `apps/api/.env`) :

- **`grid` (défaut)** — `GridPlacesSearchStrategy` : recherche en grille récursive, exhaustive
  mais potentiellement des dizaines d'appels Google par recherche.
- **`development`** — `DevelopmentSearchStrategy` : une seule recherche texte par commune connue
  de la ville (ex. `"Restaurant Bir El Djir Algeria"`), fusion des résultats, déduplication par
  Place ID. Pour Oran (7 communes dans `communes.data.ts`), ça fait 7 appels Places au lieu d'un
  nombre variable et potentiellement élevé de cellules de grille. **Pas exhaustif, volontairement** —
  fait pour itérer vite et gratuitement (grâce au cache) sur l'algorithme pendant le développement.
- Ville absente de `communes.data.ts` → repli automatique sur une recherche unique pour la ville
  elle-même (aucun échec). Ajoutez vos propres villes dans ce fichier au besoin.

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
