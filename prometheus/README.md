# Configuration Prometheus pour Proxmox Dashboard

Ce dossier contient la configuration Prometheus pour le monitoring de votre infrastructure Proxmox.

## Fichiers

- `prometheus.yml` : Configuration principale de Prometheus
- `alert_rules.yml` : Règles d'alerte pour les métriques collectées
- `README.md` : Ce fichier

## Installation

### Avec Docker Compose

Prometheus et node_exporter sont déjà configurés dans les fichiers `docker-compose.yml`. Pour les démarrer :

```bash
# Mode développement
docker-compose -f docker-compose.dev.yml up -d prometheus node_exporter

# Mode production
docker-compose -f docker-compose.prod.yml up -d prometheus node_exporter
```

### Accès à Prometheus

Une fois démarré, Prometheus est accessible à :
- **URL** : http://localhost:9090
- **Interface web** : http://localhost:9090/graph

### Accès à node_exporter

Les métriques de node_exporter sont disponibles à :
- **Métriques** : http://localhost:9100/metrics

## Configuration

### Prometheus

Le fichier `prometheus.yml` configure :
- **Scrape interval** : 15 secondes (par défaut)
- **Retention** : 30 jours
- **Jobs configurés** :
  - `prometheus` : Auto-monitoring de Prometheus
  - `nexboard-apps` : Métriques de l'API du dashboard
  - `node_exporter` : Métriques système (à décommenter si nécessaire)

### Personnalisation

Pour ajouter de nouveaux jobs de scraping :

1. Éditez `prometheus/prometheus.yml`
2. Ajoutez une nouvelle entrée dans `scrape_configs` :

```yaml
- job_name: 'mon-service'
  static_configs:
    - targets: ['mon-service:port']
      labels:
        instance: 'mon-instance'
        service: 'mon-service'
```

3. Rechargez la configuration Prometheus :
   ```bash
   curl -X POST http://localhost:9090/-/reload
   ```

Ou redémarrez le conteneur :
```bash
docker-compose restart prometheus
```

## Alertes

Les règles d'alerte sont définies dans `alert_rules.yml`. Les alertes configurées incluent :

- **HighCPUUsage** : Utilisation CPU > 80% pendant 5 minutes
- **HighMemoryUsage** : Utilisation mémoire > 85% pendant 5 minutes
- **LowDiskSpace** : Espace disque < 15% pendant 5 minutes
- **ServiceDown** : Service inaccessible pendant 2 minutes

Pour activer les alertes, décommentez la section `alerting` dans `prometheus.yml` et configurez Alertmanager.

## Intégration avec le Dashboard

1. Accédez à **Paramètres > Configuration Prometheus** dans le dashboard
2. Entrez l'URL de Prometheus :
   - **En Docker** : `http://prometheus:9090` (nom du service Docker)
   - **En local (hors Docker)** : `http://localhost:9090`
   - **Depuis l'extérieur** : `http://votre-serveur:9090`
3. Cliquez sur **Tester la connexion** pour vérifier
4. Cliquez sur **Sauvegarder**

**Note importante pour Docker** : Le backend fait les requêtes vers Prometheus, donc il doit pouvoir résoudre le nom du service. Utilisez `http://prometheus:9090` (nom du service Docker) au lieu de `http://localhost:9090` car `localhost` dans le conteneur backend ne pointe pas vers Prometheus.

Les métriques seront alors disponibles dans la page **Monitoring**.

## Requêtes PromQL utiles

### CPU moyen (1 minute)
```promql
100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[1m])) * 100)
```

### Mémoire utilisée (pourcentage)
```promql
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100
```

### Espace disque utilisé (pourcentage)
```promql
(1 - (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})) * 100
```

### Uptime
```promql
time() - node_boot_time_seconds
```

## Dépannage

### Prometheus ne démarre pas

Vérifiez les logs :
```bash
docker-compose logs prometheus
```

Vérifiez la syntaxe du fichier de configuration :
```bash
docker-compose exec prometheus promtool check config /etc/prometheus/prometheus.yml
```

### Les métriques ne sont pas collectées

1. Vérifiez que les targets sont accessibles :
   - http://localhost:9090/targets
2. Vérifiez les logs de Prometheus pour les erreurs de scraping
3. Vérifiez que les ports sont correctement exposés dans docker-compose

### node_exporter ne collecte pas de métriques

1. Vérifiez que node_exporter est accessible : http://localhost:9100/metrics
2. Vérifiez que le job `node_exporter` est décommenté dans `prometheus.yml`
3. Vérifiez les permissions des volumes montés

## Ressources

- [Documentation Prometheus](https://prometheus.io/docs/)
- [PromQL Guide](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [node_exporter Documentation](https://github.com/prometheus/node_exporter)

