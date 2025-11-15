# Analyse des fonctionnalités NexBoard - État actuel vs Spécifications

## ✅ Fonctionnalités déjà implémentées

### MVP
- ✅ Authentification simple (admin) - Backend + Frontend
- ✅ Connexion Proxmox + récupération cluster (nœuds, VMs, LXC)
- ✅ Dashboard global (Overview) avec stats cluster
- ✅ Liste des nœuds avec détails
- ✅ Liste VMs/LXC avec actions (start/stop/reboot)
- ✅ Storages (liste avec capacités)
- ✅ Système d'alertes avec SSE
- ✅ Notifications email (SMTP)
- ✅ Page paramètres (config Proxmox)
- ✅ Dark mode

### V2 partiel
- ✅ Système d'utilisateurs avec rôles (RBAC backend)
- ✅ Applications homelab (Apps page)
- ✅ Logs et tâches (TasksLogs page)

## ❌ Fonctionnalités manquantes à implémenter

### MVP manquantes
1. **Événements récents** dans Overview
   - Liste des derniers événements Proxmox (VM démarrée/arrêtée, node down, etc.)
   - Horodatage + type d'événement

2. **Quick actions** dans Overview
   - Boutons : créer VM/LXC, ouvrir liste VMs, lancer backup, ouvrir Cluster

3. **Console VNC/SPICE** pour VMs
   - Accès console Proxmox depuis la page VMs

4. **Intégration Prometheus**
   - Configuration Prometheus dans Settings
   - Page Monitoring avec graphiques CPU/RAM/Disque
   - Métriques cluster, nœuds, VMs

5. **Tags/rôles de VM**
   - Ajout de tags aux VMs
   - Filtrage par tags

6. **Données réelles Storage**
   - Intégration avec API Proxmox pour les storages

### V2 manquantes
1. **Templates & ISO**
   - Liste des templates Proxmox
   - Liste des ISO disponibles
   - Création rapide VM/LXC depuis templates

2. **Backups améliorés**
   - Intégration Proxmox Backup Server
   - Liste des backups par VM
   - Actions : lancer backup, restaurer

3. **Centre d'alertes**
   - Seuils configurables (RAM > 90%, disque > 85%, etc.)
   - Alertes automatiques basées sur seuils

4. **Intégrations homelab**
   - pfSense (statut, WAN IP)
   - Pi-hole/AdGuard (statut, stats)
   - Nginx Proxy Manager (hosts, certificats SSL)

5. **Heatmap des ressources**
   - Vue graphique charge CPU/RAM des nœuds

6. **Topologie réseau**
   - Schéma simplifié cluster, LAN, DMZ

### V3+ (futur)
- Automatisation / playbooks
- Webhooks (Discord, Slack)
- SSO / OAuth2
- Mode démo

## Plan d'implémentation prioritaire

### Phase 1 - MVP critiques
1. Événements récents dans Overview
2. Quick actions dans Overview
3. Intégration Prometheus (config + page Monitoring)
4. Console VNC/SPICE pour VMs
5. Tags VMs avec filtrage

### Phase 2 - V2 importantes
1. Templates & ISO + création rapide VM
2. Backups améliorés (PBS)
3. Centre d'alertes avec seuils
4. Intégrations homelab (pfSense, Pi-hole, NPM)

