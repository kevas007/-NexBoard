# Structure du Projet - NexBoard

Ce document décrit la structure complète du projet et les conventions utilisées.

## 📁 Structure Complète

```
nexboard/
├── .github/                    # Configuration GitHub
│   ├── workflows/              # GitHub Actions
│   └── PULL_REQUEST_TEMPLATE.md
├── .gitlab/                    # Configuration GitLab
│   └── merge_request_templates/
├── backend/                    # Backend Go
│   ├── cmd/                    # Point d'entrée de l'application
│   │   └── main.go
│   ├── internal/               # Code interne (non importable)
│   │   ├── auth/               # Authentification
│   │   ├── config/             # Configuration
│   │   ├── email/              # Service email SMTP
│   │   ├── handlers/           # Handlers HTTP
│   │   ├── middleware/         # Middlewares HTTP
│   │   ├── models/             # Modèles de données
│   │   ├── routes/             # Définition des routes
│   │   ├── seeders/            # Données de test (dev uniquement)
│   │   ├── services/           # Services métier
│   │   ├── sse/                # Server-Sent Events
│   │   └── store/              # Couche base de données
│   ├── migrations/             # Migrations SQLite
│   ├── Dockerfile              # Docker production (par défaut)
│   ├── Dockerfile.dev          # Docker développement
│   ├── Dockerfile.prod         # Docker production
│   ├── go.mod                  # Dépendances Go
│   └── go.sum                  # Checksums des dépendances
├── frontend/                   # Frontend React
│   ├── public/                 # Fichiers statiques publics
│   │   ├── images/             # Images
│   │   ├── locales/            # Traductions (copiées depuis src/locales)
│   │   └── nexboard-logo.png
│   ├── scripts/                # Scripts de build
│   │   └── copy-locales.js
│   ├── src/                    # Code source
│   │   ├── components/         # Composants React
│   │   │   └── ui/             # Composants UI réutilisables
│   │   ├── contexts/           # Contextes React
│   │   ├── hooks/              # Hooks React personnalisés
│   │   ├── pages/              # Pages de l'application
│   │   ├── test/               # Tests unitaires
│   │   ├── utils/              # Utilitaires
│   │   ├── locales/             # Fichiers de traduction source
│   │   ├── App.tsx             # Composant racine
│   │   ├── main.tsx            # Point d'entrée
│   │   └── index.css           # Styles globaux
│   ├── tests/                  # Tests E2E (Playwright)
│   │   └── e2e/
│   ├── Dockerfile              # Docker production (par défaut)
│   ├── Dockerfile.dev          # Docker développement
│   ├── Dockerfile.prod         # Docker production
│   ├── index.html              # Template HTML
│   ├── nginx.conf              # Configuration Nginx (production)
│   ├── package.json             # Dépendances Node.js
│   ├── package-lock.json        # Lock file npm
│   ├── playwright.config.ts    # Configuration Playwright
│   ├── postcss.config.js        # Configuration PostCSS
│   ├── tailwind.config.js       # Configuration Tailwind
│   ├── tsconfig.json            # Configuration TypeScript
│   ├── tsconfig.node.json       # Config TS pour Node
│   ├── vite.config.ts           # Configuration Vite
│   ├── vitest.config.ts         # Configuration Vitest
│   └── vitest.config.coverage.ts # Config Vitest couverture
├── tests/                      # Tests centralisés
│   ├── backend/                 # Tests backend Go
│   ├── frontend/               # Configuration tests frontend
│   └── README.md               # Documentation des tests
├── scripts/                    # Scripts utilitaires
│   ├── *.sh                    # Scripts Shell (Linux/Mac)
│   ├── *.ps1                   # Scripts PowerShell (Windows)
│   ├── *.js                    # Scripts Node.js
│   ├── Makefile                # Makefile Linux/Mac
│   ├── Makefile.windows        # Makefile Windows
│   └── README.md               # Documentation des scripts
├── docs/                       # Documentation
│   ├── *.md                    # Documentation Markdown
│   └── ...
├── jenkins/                    # Configuration Jenkins CI/CD
│   ├── Jenkinsfile.multibranch # Pipeline multibranch
│   ├── job-config.xml          # Configuration de job
│   ├── README.md               # Documentation Jenkins
│   └── BEST_PRACTICES.md       # Bonnes pratiques
├── prometheus/                 # Configuration Prometheus
│   ├── prometheus.yml          # Config Prometheus
│   ├── alert_rules.yml         # Règles d'alerte
│   ├── README.md              # Documentation
│   └── DOCKER.md              # Guide Docker
├── data/                       # Données de l'application (gitignored)
│   └── app.db                  # Base de données SQLite
├── .dockerignore               # Fichiers ignorés par Docker
├── .gitattributes              # Configuration Git
├── .gitignore                  # Fichiers ignorés par Git
├── .jenkinsignore              # Fichiers ignorés par Jenkins
├── docker-compose.yml          # Docker Compose (par défaut)
├── docker-compose.dev.yml      # Docker Compose développement
├── docker-compose.prod.yml     # Docker Compose production
├── env.example                 # Exemple de fichier d'environnement
├── Jenkinsfile                 # Pipeline Jenkins principal
├── LICENSE                     # Licence du projet
├── Makefile                    # Makefile principal (Linux/Mac)
├── Makefile.windows            # Makefile Windows
├── README.md                   # Documentation principale
├── CONTRIBUTING.md             # Guide de contribution
└── CODE_OF_CONDUCT.md          # Code de conduite
```

## 🎯 Conventions de Nommage

### Fichiers et Dossiers

- **Fichiers Go** : `snake_case.go` (ex: `handlers.go`, `auth.go`)
- **Fichiers React** : `PascalCase.tsx` pour composants (ex: `Layout.tsx`)
- **Fichiers utilitaires** : `camelCase.ts` (ex: `api.ts`, `auth.ts`)
- **Fichiers de config** : `kebab-case.ext` (ex: `docker-compose.dev.yml`)
- **Scripts** : `kebab-case.sh/ps1` (ex: `setup-jenkins.sh`)

### Dossiers

- **Backend** : `lowercase` (ex: `internal/`, `migrations/`)
- **Frontend** : `lowercase` (ex: `components/`, `pages/`)
- **Tests** : `tests/` à la racine, `test/` dans les modules

## 📋 Organisation par Type

### Code Source

- **Backend** : `backend/internal/` (code interne, non exportable)
- **Frontend** : `frontend/src/` (code source React/TypeScript)
- **Tests** : `tests/` (tests centralisés) + `frontend/src/test/` (tests unitaires)

### Configuration

- **Docker** : Fichiers `Dockerfile*` et `docker-compose*.yml` à la racine
- **CI/CD** : `Jenkinsfile` à la racine, configs dans `jenkins/`
- **Build** : Configs dans chaque dossier (`go.mod`, `package.json`)

### Documentation

- **Principale** : `README.md`, `CONTRIBUTING.md` à la racine
- **Technique** : `docs/` pour la documentation détaillée
- **Scripts** : `README.md` dans chaque dossier (`scripts/`, `tests/`)

### Scripts

- **Shell** : `scripts/*.sh` (Linux/Mac)
- **PowerShell** : `scripts/*.ps1` (Windows)
- **Node.js** : `scripts/*.js` (cross-platform)
- **Makefiles** : `Makefile` et `Makefile.windows`

## 🔒 Fichiers à Ignorer

### Git (.gitignore)

- `data/` : Données de l'application
- `*.db`, `*.sqlite*` : Bases de données
- `node_modules/` : Dépendances Node.js
- `dist/`, `build/` : Builds de production
- `tmp/`, `*.tmp` : Fichiers temporaires
- `.env`, `config.env` : Variables d'environnement (sauf `.example`)

### Docker (.dockerignore)

- `node_modules/` : Installé dans le conteneur
- `dist/` : Généré dans le conteneur
- `.git/` : Non nécessaire dans l'image
- `tests/` : Non nécessaire dans l'image

## 📦 Dépendances

### Backend (Go)

- **Gestion** : `go.mod`, `go.sum`
- **Installation** : `go mod download`
- **Vérification** : `go mod verify`

### Frontend (Node.js)

- **Gestion** : `package.json`, `package-lock.json`
- **Installation** : `npm ci` (recommandé pour CI/CD)
- **Mise à jour** : `npm update`

## 🧪 Tests

### Structure

- **Backend** : `tests/backend/` (tests d'intégration avec package `backend_test`)
- **Frontend unitaires** : `frontend/src/test/` (tests unitaires)
- **Frontend E2E** : `frontend/tests/e2e/` (tests Playwright)

### Exécution

```bash
# Backend (depuis tests/backend)
cd tests/backend && go test ./...

# Frontend unitaires
cd frontend && npm run test:run

# Frontend E2E
cd frontend && npm run test:e2e
```

### Note sur les tests backend

Les tests backend utilisent le package `backend_test` pour éviter les conflits avec le package `backend` du code source. Tous les fichiers de test dans `tests/backend/` doivent utiliser `package backend_test`.

## 🐳 Docker

### Images

- **Backend** : `nexboard-api`
- **Frontend** : `nexboard-web`
- **Tags** : `latest`, `dev`, `prod`, `{BUILD_NUMBER}`

### Compose Files

- **dev** : `docker-compose.dev.yml` (développement avec hot-reload)
- **prod** : `docker-compose.prod.yml` (production optimisée)
- **default** : `docker-compose.yml` (alias vers dev)

## 🔄 CI/CD

### Jenkins

- **Pipeline principal** : `Jenkinsfile` (racine)
- **Multibranch** : `jenkins/Jenkinsfile.multibranch`
- **Configuration** : `jenkins/job-config.xml`
- **Documentation** : `jenkins/README.md`

### Workflow

1. **Checkout** → Validation → Lint → Tests → Build → Docker → Deploy
2. **Branches** : `main` (prod), `dev` (dev), `feature/*` (tests uniquement)

## 📝 Bonnes Pratiques

### 1. Séparation des Responsabilités

- ✅ Code source séparé du code de test
- ✅ Configuration séparée du code
- ✅ Documentation centralisée

### 2. Organisation Modulaire

- ✅ Backend : Structure par domaine (auth, handlers, services)
- ✅ Frontend : Structure par fonctionnalité (components, pages, hooks)
- ✅ Tests : Organisation parallèle au code source

### 3. Gestion des Versions

- ✅ `go.mod` pour Go (versioning sémantique)
- ✅ `package.json` pour Node.js (versioning sémantique)
- ✅ Tags Git pour les releases

### 4. Configuration

- ✅ Fichiers `.example` pour les templates
- ✅ Variables d'environnement pour la config
- ✅ Configs Docker séparées (dev/prod)

### 5. Documentation

- ✅ README principal à la racine
- ✅ Documentation technique dans `docs/`
- ✅ README dans chaque dossier important

---

**Cette structure suit les standards de l'industrie pour les projets Go + React.**

