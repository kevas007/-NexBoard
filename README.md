# NexBoard - Dashboard de monitoring Proxmox/Docker

Un dashboard moderne pour le monitoring de clusters Proxmox, conteneurs Docker et applications, avec notifications temps réel et système d'alertes par email.

**Développé par [kevas007](https://github.com/kevas007)**

## 🚀 Fonctionnalités

- **Dashboard moderne** : Interface React avec Tailwind CSS, thème sombre/clair
- **Monitoring multi-services** : Proxmox (VMs, LXC), Docker, Applications personnalisées
- **Notifications temps réel** : Server-Sent Events (SSE) pour les alertes instantanées
- **Système d'email** : Notifications SMTP avec worker en arrière-plan
- **Base de données SQLite** : Stockage local sans CGO, migrations automatiques
- **API REST complète** : Backend Go avec chi router
- **Docker Compose** : Déploiement simple avec MailHog pour les tests

## 🏗️ Architecture

```
nexboard/
├── backend/              # API Go 1.23
│   ├── cmd/              # Point d'entrée principal
│   ├── internal/         # Code métier (non exportable)
│   │   ├── handlers/     # Handlers HTTP
│   │   ├── models/       # Modèles de données
│   │   ├── store/        # Couche base de données
│   │   ├── services/     # Services métier
│   │   ├── routes/       # Définition des routes
│   │   ├── middleware/   # Middlewares HTTP
│   │   ├── auth/         # Authentification
│   │   ├── email/        # Système d'email SMTP
│   │   └── sse/          # Server-Sent Events
│   └── migrations/       # Migrations SQLite
├── frontend/             # React 18 + Vite + Tailwind
│   ├── src/
│   │   ├── components/   # Composants UI
│   │   │   └── ui/       # Composants réutilisables
│   │   ├── pages/        # Pages du dashboard
│   │   ├── hooks/        # Hooks React personnalisés
│   │   ├── utils/        # Utilitaires (API, etc.)
│   │   └── test/         # Tests unitaires
│   └── tests/            # Tests E2E (Playwright)
├── tests/                # Tests centralisés
│   ├── backend/          # Tests backend Go
│   ├── frontend/         # Config tests frontend
│   └── README.md         # Documentation des tests
├── scripts/              # Scripts utilitaires
├── docs/                 # Documentation
├── jenkins/              # Configuration CI/CD
└── prometheus/           # Configuration monitoring
```

📚 **Structure détaillée** : [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)

## 🔄 CI/CD avec Jenkins

Le projet inclut une configuration CI/CD complète avec Jenkins :

- **Jenkinsfile** : Pipeline principal pour build, tests et déploiement
- **Multibranch Pipeline** : Support automatique des branches `dev` et `main`
- **Tests automatiques** : Backend (Go) et Frontend (React)
- **Build Docker** : Images automatiques pour dev et production
- **Déploiement** : Automatique pour `dev`, avec approbation pour `main`

📚 **Documentation complète** : [jenkins/README.md](jenkins/README.md)

**Configuration rapide** :
```bash
# Linux/Mac
./scripts/setup-jenkins.sh

# Windows
.\scripts\setup-jenkins.ps1
```

## 🛠️ Installation et démarrage

### Prérequis

- Docker et Docker Compose
- Git

### Démarrage rapide

1. **Cloner le projet**
```bash
git clone https://github.com/kevas007/NexBoard.git
cd NexBoard
```

**Note pour les contributeurs** : Si vous souhaitez contribuer au projet, veuillez :
- Utiliser la branche `dev` pour vos contributions
- La branche `main` est réservée à kevas007 uniquement
- Consultez [CONTRIBUTING.md](CONTRIBUTING.md) pour plus de détails

2. **Créer le répertoire de données**
```bash
mkdir -p data
```

3. **Démarrer les services**
```bash
docker compose up -d
```

4. **Accéder aux interfaces**
- Dashboard : http://localhost:5173
- API : http://localhost:8080
- MailHog (emails de test) : http://localhost:8025

## 📧 Configuration des emails

Le système utilise MailHog en développement pour capturer les emails. Pour la production, configurez les variables SMTP dans `docker-compose.yml` :

```yaml
environment:
  - SMTP_HOST=your-smtp-server.com
  - SMTP_PORT=587
  - SMTP_USERNAME=your-username
  - SMTP_PASSWORD=your-password
  - SMTP_FROM="ProxmoxDash <noreply@yourdomain.com>"
  - SMTP_TLS=true
```

## 🔔 Système de notifications

### Types de notifications supportés

- **SSE (Server-Sent Events)** : Notifications temps réel dans le navigateur
- **Email SMTP** : Alertes par email avec worker en arrière-plan
- **Webhook** : Intégration avec Slack, Discord, Teams (à venir)

### Test des notifications

1. **Via l'interface** : Aller dans Paramètres → Test d'email
2. **Via l'API** :
```bash
curl -X POST http://localhost:8080/api/notify/test \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com"}'
```

3. **Vérifier dans MailHog** : http://localhost:8025

## 📊 API Endpoints

### Applications
- `GET /api/apps` - Liste des applications
- `POST /api/apps` - Créer une application
- `PUT /api/apps/{id}` - Modifier une application
- `DELETE /api/apps/{id}` - Supprimer une application

### Health Checks
- `GET /api/health/http?url=...` - Vérification HTTP
- `GET /api/health/tcp?host=...&port=...` - Vérification TCP

### Alertes
- `GET /api/alerts` - Liste des alertes
- `POST /api/alerts` - Créer une alerte
- `POST /api/alerts/{id}/ack` - Accuser réception
- `GET /api/alerts/stream` - Stream SSE

### Notifications
- `POST /api/notify/test` - Test d'email
- `POST /api/notify/subscribe` - S'abonner aux notifications

## 🎨 Design System

Le dashboard utilise une palette de couleurs cohérente :

- **Primaire** : Teal (#14b8a6) - Actions principales
- **Accent** : Amber (#f59e0b) - Éléments d'attention
- **Neutre** : Slate - Textes et arrière-plans

### Composants UI

Tous les composants suivent les principes du design validé :
- Coins arrondis (`rounded-2xl`)
- Contrastes AA pour l'accessibilité
- Support thème sombre/clair
- Animations fluides

## 🔧 Développement

### Backend (Go)

```bash
cd backend
go mod download
go run cmd/main.go
```

### Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

### Tests

#### Tests Backend

Les tests backend sont dans `tests/backend/` et utilisent le package `backend_test` :

```bash
# Tous les tests backend
cd tests/backend && go test ./...

# Tests avec couverture
cd tests/backend && go test -cover ./...

# Tests spécifiques
cd tests/backend && go test -run TestStore
cd tests/backend && go test -run TestModels
```

**Note importante** : Tous les fichiers de test dans `tests/backend/` doivent utiliser `package backend_test` pour éviter les conflits avec le package `backend` du code source.

#### Tests Frontend

```bash
# Tous les tests frontend
cd frontend && npm run test:run

# Tests en mode watch
cd frontend && npm run test

# Tests avec couverture
cd frontend && npm run test:coverage

# Interface de test
cd frontend && npm run test:ui
```

📚 **Documentation complète des tests** : [tests/README.md](tests/README.md)

### Base de données

Les migrations SQLite s'exécutent automatiquement au démarrage. Structure :

- `apps` - Applications monitorées
- `alerts` - Système d'alertes
- `notify_subscriptions` - Abonnements aux notifications
- `email_queue` - File d'attente des emails

## 🚦 Monitoring et santé

### Health Checks

Tous les services incluent des health checks :

```bash
# API
curl http://localhost:8080/api/health

# Frontend
curl http://localhost:5173/health

# MailHog
curl http://localhost:8025/
```

### Logs

```bash
# Voir tous les logs
docker compose logs -f

# Logs spécifiques
docker compose logs -f api
docker compose logs -f web
```

## 🔒 Sécurité

### Configuration sécurisée

Le système utilise des fichiers de configuration pour gérer les secrets :

```bash
# Développement
cp env.example config.env

# Production (CHANGEZ LES TOKENS!)
cp env.example config.prod.env
node scripts/generate-tokens.js
```

### Authentification

- **Token-based authentication** pour les routes admin
- **3 niveaux d'accès** : public, lecture optionnelle, administration
- **Headers de sécurité** automatiques
- **CORS restrictif** par domaine
- **Validation des entrées** côté API

### Déploiement sécurisé

```bash
# Générer des tokens sécurisés
node scripts/generate-tokens.js

# Utiliser la config de production
docker compose --env-file config.prod.env up -d
```

Voir [SECURITY.md](SECURITY.md) pour le guide complet.

## 📈 Roadmap

- **v1.1** : Intégration API Proxmox complète
- **v1.2** : Support Docker Engine/Portainer
- **v1.3** : RBAC et authentification
- **v1.4** : Webhooks Slack/Discord/Teams
- **v1.5** : Métriques et graphiques avancés

## 🤝 Contribution

Nous accueillons les contributions ! Voir notre [Guide de Contribution](CONTRIBUTING.md) pour plus de détails.

### Démarrage rapide pour les contributeurs

1. **Fork le projet** sur GitHub
2. **Clone votre fork** :
   ```bash
   git clone https://github.com/VOTRE-USERNAME/NexBoard.git
   cd NexBoard
   ```
3. **Créer une branche** :
   ```bash
   git checkout -b feature/amazing-feature
   ```
4. **Installer les dépendances** :
   ```bash
   # Backend
   cd backend && go mod download
   
   # Frontend  
   cd frontend && npm install
   ```
5. **Démarrer l'environnement** :
   ```bash
   docker compose up -d
   ```

### Types de contributions

- 🐛 **Signaler des bugs** : Utilisez les issues GitHub
- ✨ **Nouvelles fonctionnalités** : Proposez via les issues
- 📝 **Documentation** : Améliorez la documentation
- 🧪 **Tests** : Ajoutez des tests unitaires
- 🎨 **UI/UX** : Améliorez l'interface utilisateur

### Code de Conduite

Ce projet suit le [Code de Conduite Contributor Covenant](CODE_OF_CONDUCT.md). En participant, vous acceptez de respecter ce code.

**Contact :** Pour signaler des violations du code de conduite, contactez [kevassiobo@gmail.com](mailto:kevassiobo@gmail.com)

## 📝 License

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

- **Proxmox VE** pour l'API de monitoring
- **React** et **Go** pour les frameworks
- **Tailwind CSS** pour le design system
- **Tous les contributeurs** qui participent au projet

---

**NexBoard** - Dashboard de monitoring moderne pour infrastructures Proxmox et Docker.

---

**Développé avec ❤️ par [kevas007](https://github.com/kevas007)**
