# Audit technique — ProspectFinder

**Date de l'audit :** 10 juillet 2026
**Périmètre :** dépôt complet (`apps/web`, `apps/api`, configuration racine)
**Méthode :** revue statique du code source, de la configuration, de l'historique Git et des dépendances. Aucune exécution de charge, aucun scan de vulnérabilité automatisé (SAST/DAST) n'a été réalisé.

---

## 1. Résumé exécutif

ProspectFinder est un projet **très jeune** (6 commits, ~2 800 lignes de code applicatif) qui pose les fondations d'un outil de prospection : recherche d'entreprises via l'API Google Places, avec un module de géocodage et une stratégie de "grid search" pour contourner la limite de 20 résultats par requête de Google.

Le code déjà écrit est **de bonne qualité** : architecture NestJS propre (modules/services/DTO/interfaces), gestion d'erreurs soignée qui ne fuite jamais les clés API, tests unitaires ciblés sur la logique métier la plus complexe (grid engine, executor avec retry/concurrence). Cependant, le projet présente un **écart majeur entre le backend et le frontend** (détaillé en §4.1) et **aucune des promesses du README n'est encore implémentée** côté scoring/qualification des prospects (§4.5) ni persistance (§4.6). Il n'y a également **aucune protection contre l'abus de l'API** (pas de rate limiting, pas d'authentification — §5).

| Axe | Évaluation |
|---|---|
| Architecture backend | Bonne — modulaire, testée, bien découplée (pattern Strategy) |
| Frontend | Basique — page d'accueil non personnisée, formulaire non connecté au meilleur endpoint |
| Sécurité | Faible — API totalement ouverte, aucun rate limiting |
| Tests | Backend correct (664 lignes sur 6 fichiers) ; Frontend nul (0 test) |
| CI/CD | Absente |
| Documentation | README racine correct ; reste minimal ou par défaut |
| Maturité produit | Prototype technique — la fonctionnalité cœur (scoring/classement) n'existe pas encore |

---

## 2. Architecture générale

Monorepo **pnpm workspaces + Turborepo**.

```
ProspectFinder/
├── apps/
│   ├── web/     Next.js 16 (App Router, React 19) — port 3000
│   └── api/     NestJS 11 + Prisma 7 (PostgreSQL) — port 3001
├── packages/    vide (aucun package partagé pour l'instant)
├── turbo.json
├── pnpm-workspace.yaml
├── eslint.config.mjs   (flat config, partagé)
└── .prettierrc          (partagé)
```

- Root [package.json](package.json) : scripts `dev`/`build`/`lint`/`check-types`/`format` délégués à Turbo ; devDependencies uniquement (ESLint 10, Prettier 3, Turbo 2, typescript-eslint 8).
- [turbo.json](turbo.json) : 4 tâches (`build`, `dev`, `lint`, `check-types`), cache activé sauf pour `dev`.
- [pnpm-workspace.yaml](pnpm-workspace.yaml) : `apps/*` + `packages/*`, avec `allowBuilds` pour `@prisma/engines`, `prisma`, `sharp`, `unrs-resolver`.
- **Anomalie structurelle confirmée** : `apps/web` possède son propre `pnpm-workspace.yaml` (contenu réel : `ignoredBuiltDependencies: [sharp, unrs-resolver]`) et son propre `pnpm-lock.yaml` (2 679 lignes, ~85 Ko), **tous deux trackés par git**, en plus de ceux de la racine. Ils ont été ajoutés dans le commit `8e9a293` (« chore: add pnpm workspace configuration… ») — probablement un artefact d'un `pnpm install` lancé directement dans `apps/web` avant l'intégration au monorepo. Un second lockfile dans un sous-dossier d'un monorepo pnpm est incohérent et peut dériver silencieusement de celui de la racine.
- Le dossier `packages/` est déclaré dans le workspace (contient seulement un `.gitkeep`) mais totalement vide : aucune logique partagée (types, DTO communs) entre `web` et `api` — les deux définissent leurs propres types dupliqués (`Company`/`GooglePlace` côté web, `GooglePlace` côté api).
- [turbo.json](turbo.json) ne définit **aucune tâche `test`** : les tests de `apps/api` ne sont exécutables que via `pnpm --filter api test`, pas via `turbo run test` — absent de l'orchestration centralisée du monorepo.

---

## 3. Stack technique

### Backend (`apps/api`)
- **NestJS 11**, **TypeScript 5.7**, **Prisma 7** (client généré vers `apps/api/generated/prisma`, ignoré par git).
- HTTP sortant via `@nestjs/axios` (axios 1.18) avec `firstValueFrom(rxjs)`.
- Validation via `class-validator` / `class-transformer`, `ValidationPipe` global avec `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` ([apps/api/src/main.ts:10-16](apps/api/src/main.ts#L10-L16)).
- Tests : Jest 30 + ts-jest, `test:e2e` séparé (`apps/api/test/app.e2e-spec.ts`).
- **tsconfig** ([apps/api/tsconfig.json](apps/api/tsconfig.json)) : `strictNullChecks: true` mais **`strict` n'est pas activé** (`noImplicitAny: false` explicite). ⚠️ Contredit l'affirmation du README racine « TypeScript partout, mode strict ».

### Frontend (`apps/web`)
- **Next.js 16** (App Router), **React 19**, **Tailwind CSS v4**, **shadcn/ui** (`@base-ui/react`).
- Formulaires : `react-hook-form` + `zod` (validation client cohérente avec les DTO backend).
- Data fetching : `@tanstack/react-query` v5.
- **tsconfig** ([apps/web/tsconfig.json](apps/web/tsconfig.json)) : `strict: true` — conforme au README, contrairement à l'API.
- **Aucun test** (pas de Jest/Vitest/Playwright configuré, pas de fichier `*.test.*`/`*.spec.*` dans `apps/web`).

### Qualité outillage
- ESLint 10 flat config centralisé ([eslint.config.mjs](eslint.config.mjs)), avec des blocs `globals` distincts pour `apps/web` (browser) et les specs Jest de l'API. Correct.
- Prettier centralisé, `printWidth: 100`, double quotes désactivées (`singleQuote: false`).
- Aucun `any` explicite trouvé dans `apps/api/src` ni `apps/web/src` (0 occurrence de `: any`).

---

## 4. Analyse des modules métier

### 4.1 ⚠️ Le frontend n'utilise pas le moteur de recherche « grid » ni le géocodage

C'est le constat le plus important de cet audit. Le backend expose **deux chemins de recherche distincts** :

1. `POST /google-places/search` ([google-places.controller.ts](apps/api/src/modules/google-places/google-places.controller.ts)) — appel Google Places **unique**, plafonné à 20 résultats, nécessite lat/lng en entrée.
2. `POST /search` ([search-engine.controller.ts](apps/api/src/modules/search-engine/search-engine.controller.ts)) — le vrai pipeline métier : géocode une ville (`GeocodingService`) puis délègue à `GridPlacesSearchStrategy`, qui subdivise récursivement la zone en quadrants tant que Google renvoie 20 résultats pile (signe de saturation), avec dédoublonnage par `place.id` ([grid-engine.service.ts:96-109](apps/api/src/modules/grid-engine/grid-engine.service.ts#L96-L109)).

Or le frontend ([apps/web/src/lib/api/google-places.ts:34](apps/web/src/lib/api/google-places.ts#L34)) appelle **exclusivement** `/google-places/search`, et le formulaire ([search-form.tsx](apps/web/src/components/search-form.tsx)) demande à l'utilisateur de saisir **manuellement latitude/longitude** plutôt qu'une ville — le module `geocoding`, entièrement fonctionnel et testé côté backend, n'est jamais atteint depuis l'UI.

**Conséquence concrète** : dans l'état actuel de l'application déployée, une recherche ne peut jamais renvoyer plus de 20 entreprises, et l'utilisateur doit connaître des coordonnées GPS au lieu de simplement taper une ville — alors que le backend sait déjà faire les deux. Le travail du dernier commit (`5e96177 feat(search-engine): integrate grid search strategy…`) n'est donc pas visible pour un utilisateur de l'UI actuelle.

### 4.2 Module `search-engine`
- Pattern **Strategy** propre : `SearchStrategy` interface ([search-strategy.interface.ts](apps/api/src/modules/search-engine/interfaces/search-strategy.interface.ts)), deux implémentations (`GooglePlacesSearchStrategy` simple, `GridPlacesSearchStrategy` récursive), liées par injection via un token `SEARCH_STRATEGY` ([search-engine.module.ts:19-22](apps/api/src/modules/search-engine/search-engine.module.ts#L19-L22)), actuellement bindé sur `GridPlacesSearchStrategy`.
- **Code mort** : `GooglePlacesSearchStrategy` est déclarée comme provider dans `search-engine.module.ts` mais n'est **jamais bindée** au token `SEARCH_STRATEGY` (celui-ci pointe exclusivement vers `GridPlacesSearchStrategy` via `useExisting`) — elle n'est donc atteignable par aucun chemin d'exécution réel, uniquement conservée pour satisfaire le contrat d'interface / d'éventuels tests futurs.
- `SearchCompaniesDto` hérite de `GeocodeAddressDto` sans champ supplémentaire — couplage DTO discutable mais documenté par un commentaire explicite.
- Le rayon de recherche est une **constante fixe** (`DEFAULT_SEARCH_RADIUS_METERS`), non paramétrable par l'utilisateur sur ce chemin (contrairement à `/google-places/search` qui l'accepte en entrée).

### 4.3 Module `grid-engine`
- Algorithme récursif de subdivision en quadrants avec approximation géométrique (rayon terrestre 6 371 km), profondeur max `MAX_GRID_DEPTH = 6` ([grid-engine.constants.ts](apps/api/src/modules/grid-engine/grid-engine.constants.ts)).
- `GoogleRequestExecutor` ([google-request-executor.ts](apps/api/src/modules/grid-engine/google-request-executor.ts)) : sémaphore de concurrence (`MAX_CONCURRENT_GOOGLE_REQUESTS = 5`), retry avec backoff exponentiel (`RETRY_BASE_DELAY_MS = 200`, jusqu'à 3 tentatives), timeout par tentative (10 s), ne retry que les erreurs `GatewayTimeout`/`ServiceUnavailable`/`BadGateway` (pas les erreurs de config/4xx). Design solide.
- **Risque de coût non plafonné** : la limite est uniquement sur la *profondeur* (6 niveaux), pas sur le *nombre total de cellules/requêtes*. Dans une zone dense où chaque cellule sature à 20 résultats jusqu'à la profondeur max, le nombre de requêtes croît en 4^depth (jusqu'à 4 096 sous-cellules théoriques), chacune facturée par Google. Aucun plafond global de requêtes ni de budget n'est appliqué au niveau du moteur.
- Bien testé : [grid-engine.service.spec.ts](apps/api/src/modules/grid-engine/grid-engine.service.spec.ts) (295 lignes), [google-request-executor.spec.ts](apps/api/src/modules/grid-engine/google-request-executor.spec.ts) (90 lignes).

### 4.4 Modules `google-places` et `geocoding`
- Intégration correcte des API Google (Places API New via `X-Goog-Api-Key`/`X-Goog-FieldMask`, Geocoding API classique via query param `key`).
- Gestion d'erreur **remarquable** : les deux services documentent explicitement ([google-places.service.ts:84-88](apps/api/src/modules/google-places/google-places.service.ts#L84-L88), [geocoding.service.ts:88-92](apps/api/src/modules/geocoding/geocoding.service.ts#L88-L92)) qu'ils ne relaient jamais l'erreur Axios brute car elle contiendrait la clé API dans les headers/params — mapping systématique vers des exceptions NestJS génériques.
- **Absence de test unitaire pour `GooglePlacesService`** (aucun `google-places.service.spec.ts`), alors que `GeocodingService` (135 lignes de tests) et le grid-engine sont couverts. Incohérence de couverture.
- Le field mask Google Places est limité à 9 champs utiles (id, nom, adresse, téléphone, site web, note, nb avis, position, lien Maps) — cohérent avec l'usage prospection, minimise le coût par requête (Google facture par champ demandé).
- **Duplication de logique** : la méthode privée `toHttpException` est réimplémentée quasiment à l'identique dans `GooglePlacesService` ([google-places.service.ts:89-112](apps/api/src/modules/google-places/google-places.service.ts#L89-L112)) et `GeocodingService` ([geocoding.service.ts:93-113](apps/api/src/modules/geocoding/geocoding.service.ts#L93-L113)) — même structure de mapping d'erreur Axios, même commentaire sur la non-fuite de la clé API — sans classe/fonction utilitaire commune pour factoriser ce mapping.
- Un script CLI existe pour tester manuellement le pipeline complet : [apps/api/scripts/manual-grid-search.ts](apps/api/scripts/manual-grid-search.ts) (64 lignes, `pnpm --filter api run search:manual -- "Restaurant" "Oran" "Algeria"`), utile en développement mais qui appelle les vraies API Google (facturées) et n'est couvert par aucun test.

### 4.5 Absence de logique de scoring/qualification
Le README racine décrit ProspectFinder comme un outil qui « identifie, analyse et **classe automatiquement** les entreprises ayant le plus fort potentiel ». Aucune trace de logique de scoring, classement ou qualification n'existe dans le code (recherche des termes `score`, `ranking`, `potentiel`, `classement` : aucun résultat dans `apps/api/src` ou `apps/web/src`). Le pipeline actuel renvoie la liste brute de résultats Google Places, triée dans l'ordre renvoyé par l'API. La fonctionnalité cœur du produit (telle que décrite) n'est pas encore développée.

### 4.6 Prisma / persistance non utilisée
- [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma) ne définit **aucun modèle** — seulement le générateur et la datasource.
- Aucune recherche, aucun résultat, aucun historique n'est persisté : chaque recherche interroge Google en direct et le résultat n'existe que dans l'état React côté client (perdu à chaque rechargement de page).
- Le `README.md` racine anticipe correctement cet état (« PostgreSQL … quand des modèles seront définis »), donc ce n'est pas un oubli mais un chantier non commencé.

### 4.7 Frontend — état des lieux
- La page d'accueil ([apps/web/src/app/page.tsx](apps/web/src/app/page.tsx)) est **encore le boilerplate par défaut** de `create-next-app` (logo Next.js, liens vers Vercel/docs Next.js) — non personnalisée pour le produit.
- La page fonctionnelle est `/search` ([apps/web/src/app/search/page.tsx](apps/web/src/app/search/page.tsx)), reliée à `CompanySearch` → `SearchForm` + `CompanyList`/`CompanyCard`.
- Composants UI (`company-card.tsx`, `company-list.tsx`) simples, propres, accessibles (`aria-hidden` sur les icônes décoratives, `rel="noopener noreferrer"` sur les liens externes).
- Types dupliqués entre backend et frontend (`GooglePlace` redéfini indépendamment dans [apps/web/src/lib/api/google-places.ts:10-18](apps/web/src/lib/api/google-places.ts#L10-L18) et [apps/api/src/modules/google-places/interfaces/google-place.interface.ts](apps/api/src/modules/google-places/interfaces/google-place.interface.ts)) — risque de divergence silencieuse si le field mask backend change sans mise à jour du frontend. Le dossier `packages/` vide serait l'endroit naturel pour un package de types partagés.
- `AGENTS.md`/`CLAUDE.md` présents dans `apps/web` avertissant que Next.js 16 diffère significativement des versions connues des LLM — signal que le projet suit d'assez près les toutes dernières versions (React 19.2, Next 16.2, Tailwind v4), ce qui augmente le risque de bugs liés à l'immaturité de l'écosystème.

---

## 5. Sécurité

| Constat | Détail | Sévérité |
|---|---|---|
| **Aucune authentification/autorisation** | Aucun `Guard`, aucune dépendance `passport`/`jwt` dans `apps/api`. Les 3 endpoints (`/search`, `/google-places/search`, `/geocoding`) sont ouverts à quiconque atteint l'API. | Élevée (si exposé publiquement) |
| **Aucun rate limiting** | Pas de `@nestjs/throttler` ni équivalent. Combiné à l'absence de plafond global sur le grid-engine (§4.3), un client peut déclencher des milliers d'appels Google Places facturés en quelques requêtes. | Élevée |
| **Pas de `helmet`** | Aucun header de sécurité HTTP additionnel (CSP, X-Frame-Options, etc.) configuré. | Moyenne |
| **CORS** | Correctement restreint à une origine unique configurable via `WEB_ORIGIN` ([main.ts:7-9](apps/api/src/main.ts#L7-L9)), pas de wildcard. | ✅ Bon |
| **Clés API** | Aucune clé hardcodée trouvée dans le **code source** (recherche `AIza`, `apiKey=`, etc. infructueuse sur les fichiers `.ts`/`.tsx`). `apps/api/.env` contient en revanche une **vraie clé Google Maps Platform en clair** (réutilisée pour `GOOGLE_PLACES_API_KEY` et `GOOGLE_GEOCODING_API_KEY`), mais ce fichier est correctement ignoré par `.gitignore` et confirmé absent de tout l'historique Git (`git log --all --full-history -- apps/api/.env` ne retourne rien, `git ls-files` ne montre que `.env.example`). ⚠️ **Recommandation opérationnelle** : vérifier que cette clé n'a jamais fuité ailleurs (capture d'écran, partage de terminal, etc.) et la faire tourner (rotation) si un doute existe ; en production, restreindre la clé par référent HTTP/IP et par API activée dans la console Google Cloud. `DATABASE_URL` dans ce même `.env` est resté à la valeur par défaut générée par Prisma (`postgresql://johndoe:randompassword@...`), signe que PostgreSQL n'est pas réellement configuré en local. | ⚠️ Bon pour le code, à surveiller pour le fichier `.env` local |
| **Fuite de clé via erreurs** | Design explicite pour ne jamais logger/relayer les erreurs Axios brutes contenant la clé (§4.4). | ✅ Bon |
| **Validation des entrées** | `ValidationPipe` global strict (`whitelist`, `forbidNonWhitelisted`, `transform`) + `class-validator` sur chaque DTO (bornes lat/lon/radius, `IsNotEmpty`). Cohérent avec la validation Zod côté client. | ✅ Bon |
| **Injection SQL/commande** | Non applicable actuellement : aucune requête DB (Prisma sans modèles), aucun appel système/`exec`. | ✅ N/A pour l'instant |
| **`apps/web/pnpm-lock.yaml` dupliqué** | Un second lockfile dans `apps/web` (voir §2) peut créer une dérive de dépendances par rapport au lockfile racine si `pnpm install` y est lancé isolément. | Faible |

---

## 6. Qualité de code

- **Taille du code** : ~1 730 lignes dans `apps/api/src`, ~1 043 lignes dans `apps/web/src`. Aucun fichier ne dépasse ~180 lignes (`grid-engine.service.ts` est le plus long). Pas de fichier monolithique.
- **Duplication** : faible en général ; la duplication notable est structurelle (types `GooglePlace`/`Company` dupliqués front/back, §4.7) plutôt que du copier-coller de logique.
- **Conventions de nommage** : cohérentes (kebab-case pour les fichiers, PascalCase pour les classes/interfaces, suffixes `.service`/`.controller`/`.module`/`.dto`/`.interface` respectés partout côté NestJS).
- **Commentaires** : utilisés avec parcimonie et à bon escient — expliquent des invariants non triviaux (pourquoi l'erreur Axios brute n'est jamais relayée, pourquoi le dédoublonnage se fait strictement par `id`, pourquoi l'executor est recréé à chaque recherche) plutôt que de paraphraser le code.
- **Gestion d'erreurs** : systématique côté API (try/catch + mapping vers exceptions NestJS typées), et côté frontend (`ApiError` custom avec code HTTP, message utilisateur en français, gestion du cas réseau indisponible — [google-places.ts:39-41](apps/web/src/lib/api/google-places.ts#L39-L41)).
- **`any` explicite** : 0 occurrence détectée dans le code applicatif.
- **Mode strict TypeScript incohérent** entre les deux apps (`web` strict, `api` non strict — voir §3), à corriger pour tenir la promesse du README.

---

## 7. Tests

| Fichier | Lignes | Portée |
|---|---|---|
| `apps/api/src/modules/grid-engine/grid-engine.service.spec.ts` | 295 | Logique de subdivision, dédoublonnage, stats |
| `apps/api/src/modules/geocoding/geocoding.service.spec.ts` | 135 | Géocodage, cas d'erreur (ZERO_RESULTS, statuts non-OK) |
| `apps/api/src/modules/grid-engine/google-request-executor.spec.ts` | 90 | Concurrence, retry/backoff, timeout |
| `apps/api/src/modules/search-engine/search-engine.service.spec.ts` | 70 | Délégation geocode → stratégie |
| `apps/api/src/modules/search-engine/strategies/grid-places-search.strategy.spec.ts` | 52 | Mapping stratégie ↔ grid-engine |
| `apps/api/src/app.controller.spec.ts` | 22 | Test par défaut Nest CLI |
| `apps/api/test/app.e2e-spec.ts` | — | Test e2e par défaut Nest CLI (non personnalisé) |

**Total backend : 664 lignes de tests unitaires**, ciblés sur la logique la plus critique (algorithme de grid search, concurrence/retry). Qualité des tests élevée : cas nominaux et cas d'erreur couverts, mocks propres via `Test.createTestingModule`.

**Lacunes** :
- Aucun test pour `GooglePlacesService` (mapping des erreurs Google, construction de la requête).
- Aucun test pour les contrôleurs (hors `AppController` par défaut) ni pour la validation des DTO.
- **Aucun test côté frontend** (0 fichier `*.test.*`/`*.spec.*` dans `apps/web`, pas de framework de test installé).
- Pas de couverture mesurée/publiée (script `test:cov` existe mais aucun rapport commité, normal et attendu).

---

## 8. CI/CD

**Aucune CI/CD configurée** : pas de dossier `.github/workflows`, ni GitLab CI, ni autre pipeline détecté. Les scripts `lint`, `check-types`, `test`, `build` existent et fonctionnent localement via Turbo/pnpm mais ne sont exécutés automatiquement à aucune étape (push, PR). Aucune protection de branche vérifiable depuis le dépôt local.

---

## 9. Documentation

- **README racine** ([README.md](README.md))  : clair, à jour, décrit correctement l'architecture, les prérequis, les scripts et la stack — bonne qualité pour un projet à ce stade.
- **README `apps/api`** : boilerplate par défaut généré par Nest CLI, non personnalisé pour le projet.
- **`apps/web/README.md`** : probablement le boilerplate `create-next-app` par défaut (non vérifié en détail, cohérent avec la page d'accueil non personnalisée constatée en §4.7).
- **`apps/web/AGENTS.md` / `CLAUDE.md`** : note utile pour les agents IA sur les breaking changes de Next.js 16, mais absente d'information équivalente pour des développeurs humains rejoignant le projet.
- Aucune documentation d'architecture dédiée (diagrammes, ADR) au-delà du schéma en arbre du README.
- Commentaires de code de bonne qualité (voir §6), compensent partiellement l'absence de documentation externe.

---

## 10. Dépendances notables

- **Versions très récentes / pré-stabilisation potentielle** : Next.js 16.2.10, React 19.2.4, Tailwind CSS v4, ESLint 10, Prisma 7, NestJS 11 — toutes des majors récentes. Cela signifie un écosystème d'exemples/plugins tiers encore en rattrapage, et un risque de bugs de jeunesse plus élevé qu'avec des versions LTS.
- `pnpm@11.10.0` figé via `packageManager` — bonne pratique pour la reproductibilité.
- Aucune dépendance manifestement abandonnée ou avec CVE connue identifiée dans cette revue statique (aucun `npm audit`/`pnpm audit` exécuté dans le cadre de cet audit — à faire en complément).
- `apps/web` dépend de `shadcn` en tant que **dépendance de production** (pas devDependency) — `shadcn` est normalement un outil CLI de scaffolding, pas censé être une dépendance runtime ; à vérifier si c'est intentionnel ou une erreur de `pnpm add` au lieu de `pnpm dlx shadcn@latest add …`.
- `axios: ^1.18.1` déclaré dans `apps/api/package.json` — ce numéro de version est anormalement élevé pour la ligne 1.x d'axios ; à vérifier manuellement sur le registre npm que cette version existe bien et n'est pas une erreur de saisie (typosquatting/version fantôme), avant tout `pnpm install` en environnement neuf.
- Prisma (`@prisma/client ^7.8.0`, `prisma ^7.8.0`) est installé et configuré (`prisma.config.ts`, `schema.prisma`) mais **totalement inutilisé dans le code applicatif** : aucun `model` dans `schema.prisma`, aucun `PrismaService`, aucun import de `@prisma/client` nulle part dans `apps/api/src` — confirmé par recherche exhaustive. Dépendance posée « en préparation » sans usage actuel (cf. §4.6).

---

## 11. Synthèse des constats par priorité

### Critique / à traiter avant toute mise en production
1. **Aucun rate limiting ni auth sur l'API** — expose à un abus de quota Google Places/Geocoding (coût direct) et à un DoS applicatif (§5).
2. **Le grid-engine n'a pas de plafond global de requêtes** — un abus combiné au point 1 peut générer un coût Google incontrôlé (§4.3).

### Majeur / cohérence produit
3. **Le frontend n'utilise pas `/search` (géocodage + grid search)** — la fonctionnalité principale développée dans le dernier commit n'est pas accessible aux utilisateurs (§4.1).
4. **Aucune logique de scoring/classement** — écart entre la promesse du README et l'implémentation actuelle (§4.5).

### Mineur / dette technique
5. `apps/api/tsconfig.json` sans `strict: true` — incohérent avec `apps/web` et avec le README (§3, §6).
6. Lockfile + workspace pnpm dupliqués dans `apps/web`, trackés par git (§2, §5).
7. Types `GooglePlace`/`Company` dupliqués front/back sans package partagé (§4.7).
8. Pas de test pour `GooglePlacesService` ni pour les contrôleurs (§7).
9. Pages/README par défaut non personnalisés (`apps/web/src/app/page.tsx`, `apps/api/README.md`) (§4.7, §9).
10. Absence totale de CI/CD (§8), et `turbo.json` sans tâche `test` (§2).
11. `shadcn` en dépendance de production plutôt que dev (§10).
12. Logique `toHttpException` dupliquée entre `GooglePlacesService` et `GeocodingService` (§4.4).
13. `GooglePlacesSearchStrategy` est du code mort (jamais bindé au token `SEARCH_STRATEGY`) (§4.2).
14. Version `axios@^1.18.1` à vérifier — numéro anormalement élevé pour cette ligne majeure (§10).
15. Clé API Google en clair dans `apps/api/.env` local (non commitée, correctement ignorée) — à faire tourner par précaution et à restreindre par référent/API dans la console Google Cloud avant toute mise en production (§5).

---

*Cet audit reflète l'état du dépôt au commit `5e96177` sur la branche `main`, arbre de travail propre au moment de l'analyse.*
