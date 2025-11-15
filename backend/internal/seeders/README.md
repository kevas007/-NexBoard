# Système de Seeders - Dev/Prod

## Description

Ce système permet de distinguer les environnements de développement et de production :

- **Dev** : Les seeders sont automatiquement chargés avec des données de test
- **Production** : La base de données reste vierge, aucune donnée de test n'est chargée

## Configuration

L'environnement est déterminé par la variable d'environnement `ENV` ou `NODE_ENV` :

- `ENV=dev` ou `NODE_ENV=development` → Mode développement (seeders activés)
- `ENV=production` ou `NODE_ENV=production` → Mode production (seeders désactivés)

## Données de test créées en dev

### Utilisateurs

| Username | Email | Password | Rôle |
|----------|-------|----------|------|
| admin | admin@proxmox-dash.local | admin123 | admin |
| user | user@proxmox-dash.local | user123 | user |
| viewer | viewer@proxmox-dash.local | viewer123 | viewer |
| ops | ops@proxmox-dash.local | ops123 | user |
| guest | guest@proxmox-dash.local | guest123 | guest |

### Applications (13 applications)

**Infrastructure:**
- Proxmox VE (https://pve.example.com:8006)
- Portainer (https://portainer.local:9443)

**Réseau:**
- Pi-hole (http://pihole.local:80)
- Nginx Proxy Manager (https://npm.local:443)
- pfSense (https://pfsense.local:443)

**Monitoring:**
- Grafana (https://grafana.local:3000)
- Prometheus (http://prometheus.local:9090)

**Média:**
- Plex Media Server (http://plex.local:32400)
- qBittorrent (http://qbittorrent.local:8080)
- Radarr (http://radarr.local:7878)
- Sonarr (http://sonarr.local:8989)

**IoT:**
- Home Assistant (https://homeassistant.local:8123)

### Alertes

12 alertes de test avec différents niveaux de sévérité (low, medium, high, critical) couvrant :
- Événements Proxmox (VM/LXC démarrés, migrations)
- Alertes système (CPU, mémoire, stockage)
- Alertes réseau
- Alertes backup
- Alertes monitoring

### Abonnements de notifications

- 2 abonnements email (activés)
- 2 webhooks (Slack, Discord - désactivés par défaut)

### Queue d'emails

3 emails de test dans la queue :
- 1 email envoyé (bienvenue)
- 2 emails en attente (alertes et rapports)

## Sécurité

⚠️ **Important** : Les seeders ne sont **jamais** exécutés en production. La base de données reste vierge et vous devez créer manuellement vos utilisateurs et configurations.

## Utilisation

### Mode développement

```bash
# Dans config.env ou .env
ENV=dev
```

Au démarrage, les seeders seront automatiquement chargés si la base est vide.

### Mode production

```bash
# Dans config.env ou .env
ENV=production
```

Aucune donnée de test ne sera chargée.

## Vérification

Les seeders vérifient si des données existent déjà avant de s'exécuter. Si des utilisateurs existent, les seeders sont ignorés pour éviter d'écraser des données existantes.

