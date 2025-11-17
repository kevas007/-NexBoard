# Configuration Prometheus sous Docker

Ce guide explique comment utiliser Prometheus avec Proxmox Dashboard dans un environnement Docker.

## Démarrage rapide

### 1. Démarrer les services

```bash
# Mode développement
docker-compose -f docker-compose.dev.yml up -d prometheus node_exporter

# Mode production
docker-compose -f docker-compose.prod.yml up -d prometheus node_exporter
```

### 2. Vérifier que Prometheus fonctionne

Accédez à l'interface Prometheus :
- **URL** : http://localhost:9090
- **Status** : http://localhost:9090/-/healthy
- **Targets** : http://localhost:9090/targets (pour voir les jobs de scraping)

### 3. Configurer dans le Dashboard

1. Ouvrez le dashboard Proxmox
2. Allez dans **Paramètres > Configuration Prometheus**
3. Entrez l'URL : **`http://prometheus:9090`**
   - ⚠️ **Important** : Utilisez `http://prometheus:9090` (nom du service Docker) et **PAS** `http://localhost:9090`
   - Le backend fait les requêtes depuis le conteneur `api`, donc il doit utiliser le nom du service Docker
4. Cliquez sur **Tester la connexion**
5. Cliquez sur **Sauvegarder**

### 4. Vérifier les métriques

1. Allez dans la page **Monitoring**
2. Cliquez sur **Actualiser**
3. Les métriques CPU, Mémoire et Disque devraient s'afficher

## Architecture Docker

```
┌─────────────┐
│   Frontend  │ (web:5173)
│   (nginx)   │
└──────┬──────┘
       │ /api → proxy
       ▼
┌─────────────┐
│   Backend   │ (api:8080)
│    (Go)     │
└──────┬──────┘
       │ HTTP request
       ▼
┌─────────────┐
│  Prometheus │ (prometheus:9090)
└──────┬──────┘
       │ scrape
       ▼
┌─────────────┐
│node_exporter│ (node_exporter:9100)
└─────────────┘
```

## Résolution des problèmes

### Erreur 404 sur `/api/v1/prometheus/query`

**Problème** : Le frontend ne peut pas accéder à l'API backend.

**Solution** :
1. Vérifiez que tous les services sont sur le même réseau Docker :
   ```bash
   docker network inspect nexboard-network
   ```
2. Vérifiez que les services `api` et `web` sont bien dans le réseau :
   ```bash
   docker-compose -f docker-compose.dev.yml ps
   ```

### Prometheus ne peut pas scraper node_exporter

**Problème** : Les targets montrent "DOWN" dans Prometheus.

**Solution** :
1. Vérifiez que `node_exporter` est démarré :
   ```bash
   docker-compose ps node_exporter
   ```
2. Vérifiez les logs :
   ```bash
   docker-compose logs node_exporter
   ```
3. Vérifiez que Prometheus peut accéder à node_exporter :
   ```bash
   docker-compose exec prometheus wget -qO- http://node_exporter:9100/metrics | head
   ```

### Le backend ne peut pas accéder à Prometheus

**Problème** : Les requêtes depuis le dashboard échouent.

**Solution** :
1. Vérifiez que vous utilisez `http://prometheus:9090` et non `http://localhost:9090`
2. Testez depuis le conteneur backend :
   ```bash
   docker-compose exec api wget -qO- http://prometheus:9090/-/healthy
   ```
3. Vérifiez les logs du backend :
   ```bash
   docker-compose logs api | grep -i prometheus
   ```

### Les métriques ne s'affichent pas

**Problème** : Le dashboard affiche "Aucune métrique reçue".

**Solution** :
1. Vérifiez que node_exporter collecte des métriques :
   ```bash
   curl http://localhost:9100/metrics | grep node_cpu
   ```
2. Vérifiez que Prometheus scrape node_exporter :
   - Allez sur http://localhost:9090/targets
   - Le job `node_exporter` doit être "UP"
3. Testez une requête PromQL directement :
   ```bash
   curl "http://localhost:9090/api/v1/query?query=node_cpu_seconds_total"
   ```

## Commandes utiles

### Voir les logs
```bash
# Logs Prometheus
docker-compose logs -f prometheus

# Logs node_exporter
docker-compose logs -f node_exporter

# Logs backend
docker-compose logs -f api
```

### Recharger la configuration Prometheus
```bash
# Sans redémarrer
curl -X POST http://localhost:9090/-/reload

# Ou redémarrer
docker-compose restart prometheus
```

### Vérifier la configuration
```bash
docker-compose exec prometheus promtool check config /etc/prometheus/prometheus.yml
```

### Accéder au shell de Prometheus
```bash
docker-compose exec prometheus sh
```

## Variables d'environnement

Les services utilisent les variables suivantes (définies dans `config.env`) :

- **Prometheus** : Aucune variable requise (configuration via fichiers)
- **node_exporter** : Aucune variable requise
- **Backend** : Utilise `VITE_API_URL` pour le frontend (déjà configuré)

## Ports exposés

- **Prometheus** : `9090` → http://localhost:9090
- **node_exporter** : `9100` → http://localhost:9100/metrics
- **Backend API** : `8081` → http://localhost:8081
- **Frontend** : `5173` → http://localhost:5173

## Volumes persistants

Les données Prometheus sont stockées dans le volume `prometheus-data` :
```bash
# Voir la taille du volume
docker volume inspect nexboard_prometheus-data

# Supprimer les données (⚠️ attention)
docker volume rm nexboard_prometheus-data
```

## Mise à jour

Pour mettre à jour Prometheus :
```bash
docker-compose pull prometheus node_exporter
docker-compose up -d prometheus node_exporter
```

Les données existantes seront préservées dans le volume.

