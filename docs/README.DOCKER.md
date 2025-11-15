# Guide Docker - Développement et Production

Ce projet utilise des configurations Docker séparées pour le développement et la production.

## 🚀 Démarrage rapide

### Mode Développement

```bash
# Avec Makefile (recommandé)
make dev

# Ou manuellement
docker-compose -f docker-compose.dev.yml up --build
```

**Caractéristiques du mode dev :**
- ✅ Hot reload pour le frontend (Vite)
- ✅ Hot reload pour le backend (Air)
- ✅ Volumes montés pour modifier le code sans reconstruire
- ✅ Seeders automatiques activés (`ENV=dev`)
- ✅ Source maps activés
- ✅ Logs détaillés

### Mode Production

```bash
# Avec Makefile (recommandé)
make prod

# Ou manuellement
docker-compose -f docker-compose.prod.yml up --build
```

**Caractéristiques du mode prod :**
- ✅ Build optimisé et minifié
- ✅ Images légères (multi-stage builds)
- ✅ Pas de seeders (`ENV=production`)
- ✅ Nginx pour servir le frontend
- ✅ Restart automatique en cas d'erreur
- ✅ Pas de volumes de code source

## 📋 Commandes disponibles

### Avec Makefile

```bash
make help          # Affiche toutes les commandes
make dev           # Démarrer en mode développement
make prod          # Démarrer en mode production
make build-dev     # Construire les images dev
make build-prod    # Construire les images prod
make up-dev        # Démarrer les conteneurs dev
make up-prod       # Démarrer les conteneurs prod
make down-dev      # Arrêter les conteneurs dev
make down-prod     # Arrêter les conteneurs prod
make logs-dev      # Voir les logs dev
make logs-prod     # Voir les logs prod
make clean         # Nettoyer tout
```

### Sans Makefile

```bash
# Développement
docker-compose -f docker-compose.dev.yml up --build
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml logs -f

# Production
docker-compose -f docker-compose.prod.yml up --build
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml logs -f
```

## 🔧 Configuration

### Variables d'environnement

Les variables d'environnement sont chargées depuis `config.env` :

```env
# Mode développement
ENV=dev

# Mode production
ENV=production
```

### Ports

- **Frontend Dev** : http://localhost:5173 (Vite dev server)
- **Frontend Prod** : http://localhost:5173 (Nginx)
- **Backend** : http://localhost:8081
- **MailHog UI** : http://localhost:8025
- **MailHog SMTP** : localhost:1025

## 📁 Structure des Dockerfiles

```
frontend/
  ├── Dockerfile.dev      # Dev: Vite avec hot reload
  └── Dockerfile.prod     # Prod: Build + Nginx

backend/
  ├── Dockerfile.dev      # Dev: Go avec Air (hot reload)
  ├── Dockerfile.prod     # Prod: Build binaire optimisé
  └── .air.toml          # Configuration Air pour hot reload
```

## 🔥 Hot Reload

### Frontend (Dev)
Le frontend utilise Vite en mode développement avec hot module replacement (HMR).
Les modifications dans le code sont automatiquement reflétées dans le navigateur.

### Backend (Dev)
Le backend utilise [Air](https://github.com/cosmtrek/air) pour le hot reload.
Les modifications dans les fichiers `.go` déclenchent automatiquement une recompilation et un redémarrage.

## 🐛 Dépannage

### Les changements ne sont pas pris en compte (Dev)

1. Vérifiez que les volumes sont bien montés :
   ```bash
   docker-compose -f docker-compose.dev.yml config
   ```

2. Vérifiez les logs :
   ```bash
   make logs-dev
   ```

### Erreur de build

1. Nettoyez les images et volumes :
   ```bash
   make clean
   ```

2. Reconstruisez :
   ```bash
   make build-dev
   ```

### Le hot reload ne fonctionne pas

1. Vérifiez que vous utilisez `docker-compose.dev.yml`
2. Vérifiez les logs d'Air (backend) :
   ```bash
   docker-compose -f docker-compose.dev.yml logs api
   ```

## 📦 Images Docker

### Développement
- **Frontend** : `node:18-alpine` avec Vite
- **Backend** : `golang:1.22-alpine` avec Air

### Production
- **Frontend** : `nginx:alpine` (image finale légère)
- **Backend** : `alpine:latest` (image finale minimale)

## 🔐 Sécurité

En production :
- Les conteneurs s'exécutent avec un utilisateur non-root
- Les images sont optimisées et minimales
- Pas de dépendances de développement incluses
- Health checks activés

## 📝 Notes

- Les seeders ne s'exécutent qu'en mode développement (`ENV=dev`)
- En production, la base de données reste vierge
- Les volumes de données (`./data`) sont partagés entre dev et prod
- Utilisez `make clean` pour nettoyer complètement l'environnement

