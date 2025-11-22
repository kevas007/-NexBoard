# NexBoard - Dashboard de monitoring Proxmox/Docker

Un dashboard moderne pour le monitoring de clusters Proxmox, conteneurs Docker et applications, avec notifications temps réel et système d'alertes par email.

**Développé par [kevas007](https://github.com/kevas007)**

## 🚀 Fonctionnalités

- **Dashboard moderne** : Interface React avec Tailwind CSS, thème sombre/clair
- **Monitoring multi-services** : Proxmox (VMs, LXC), Docker, Applications personnalisées
- **Gestion des VMs Proxmox** : Contrôle complet (démarrer, arrêter, pause, reprise, redémarrer)
- **Liaison applications-ressources** : Lien automatique des applications aux VMs, LXC ou conteneurs Docker
- **Filtrage avancé** : Filtrage par type de ressource avec indicateurs visuels (bordures colorées, badges)
- **Notifications temps réel** : Server-Sent Events (SSE) pour les alertes instantanées
- **Système d'email** : Notifications SMTP avec worker en arrière-plan
- **Base de données SQLite** : Stockage local sans CGO, migrations automatiques
- **API REST complète** : Backend Go avec chi router
- **Docker Compose** : Déploiement simple avec MailHog pour les tests
- **Environnements dev/prod** : Système de seeders pour développement, base vierge en production

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
- Accès réseau à votre serveur Proxmox (pour le monitoring)

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

3. **Configurer l'environnement** (optionnel)
```bash
# Copier le fichier d'exemple
cp env.example config.env

# Éditer config.env pour configurer :
# - SMTP (production)
# - Tokens de sécurité
# - Variables d'environnement (ENV=dev pour développement)
```

4. **Démarrer les services**
```bash
# Développement
docker compose -f docker-compose.dev.yml up -d

# Production
docker compose -f docker-compose.prod.yml up -d
```

5. **Accéder aux interfaces**
- Dashboard : http://localhost:5173
- API : http://localhost:8081
- MailHog (emails de test) : http://localhost:8025

### Configuration Proxmox

Pour utiliser les fonctionnalités de monitoring Proxmox :

1. **Accéder aux Paramètres** dans le dashboard
2. **Configurer la connexion Proxmox** :
   - URL : `https://votre-serveur-proxmox:8006`
   - Username : Votre utilisateur Proxmox ou token API
   - Secret : Votre mot de passe ou secret du token API
   - Node : Le nom du nœud (optionnel)

**Note réseau Docker** : Si Proxmox est sur la même machine que Docker, utilisez `host.docker.internal` au lieu de l'IP locale dans l'URL Proxmox. La configuration Docker inclut déjà `extra_hosts` pour permettre l'accès au réseau de l'hôte.

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
- `POST /api/apps` - Créer une application (avec liaison optionnelle à VM/LXC/Docker)
- `PUT /api/apps/{id}` - Modifier une application
- `DELETE /api/apps/{id}` - Supprimer une application

### Proxmox
- `POST /api/v1/proxmox/fetch-vms` - Récupérer les VMs depuis Proxmox
- `POST /api/v1/proxmox/fetch-lxc` - Récupérer les conteneurs LXC
- `POST /api/v1/proxmox/fetch-docker` - Récupérer les conteneurs Docker
- `POST /api/v1/proxmox/vm/{action}` - Actions sur les VMs (start, stop, pause, resume, restart)
- `POST /api/v1/proxmox/vm/console` - Obtenir l'URL de la console VNC (dev uniquement)
- `POST /api/v1/proxmox/vm/config` - Obtenir l'URL de configuration (dev uniquement)

### Health Checks
- `GET /api/health/http?url=...` - Vérification HTTP avec messages d'erreur détaillés
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

- `apps` - Applications monitorées (avec liaison optionnelle aux ressources Proxmox)
  - `resource_type` : Type de ressource liée ('vm', 'lxc', 'docker')
  - `resource_id` : ID de la ressource
  - `resource_node` : Nom du nœud (pour VM/LXC)
- `alerts` - Système d'alertes
- `notify_subscriptions` - Abonnements aux notifications
- `email_queue` - File d'attente des emails

### Système de seeders (Développement)

En mode développement (`ENV=dev`), des données de test sont automatiquement chargées :
- **5 utilisateurs** de test (admin, user, viewer, ops, guest)
- **13 applications** de test (Proxmox, Portainer, Grafana, etc.)
- **12 alertes** de test avec différents niveaux de sévérité
- **Abonnements** et **emails** de test

En production (`ENV=production`), aucune donnée de test n'est chargée. La base reste vierge.

📚 **Documentation complète** : [backend/internal/seeders/README.md](backend/internal/seeders/README.md)

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

## ✨ Fonctionnalités récentes

### Gestion des VMs Proxmox
- **Contrôle complet** : Démarrer, arrêter, mettre en pause, reprendre, redémarrer
- **Détection automatique** : Statut des VMs synchronisé avec Proxmox
- **Gestion d'erreurs améliorée** : Messages d'erreur détaillés pour diagnostiquer les problèmes de connexion

### Liaison applications-ressources
- **Détection automatique** : Les applications peuvent être automatiquement liées aux VMs, LXC ou conteneurs Docker basés sur l'IP
- **Filtrage par type** : Filtrez les applications par type de ressource (VM, LXC, Docker, Aucune)
- **Indicateurs visuels** : Bordures colorées et badges pour identifier rapidement le type de ressource liée

### Améliorations réseau Docker
- **Accès réseau amélioré** : Configuration `extra_hosts` pour permettre au backend d'accéder à Proxmox
- **Support host.docker.internal** : Utilisation recommandée si Proxmox est sur la même machine

### Interface utilisateur
- **Boutons conditionnels** : Les boutons Console et Config sont masqués en production, visibles uniquement en développement
- **Messages d'erreur améliorés** : Messages plus clairs avec suggestions de résolution

## 📈 Roadmap

- **v1.1** ✅ : Intégration API Proxmox complète (terminé)
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
