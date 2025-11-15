# consignes-nextboard.md

## 0. Objectif de NexBoard

NexBoard est un **dashboard centralisé pour homelab Proxmox** qui permet de :
- Superviser l’état du cluster (nœuds, VMs, LXC, stockage, réseau).
- Agir rapidement (start/stop VMs, ouvrir consoles, lancer des backups).
- Visualiser les métriques (Prometheus).
- Centraliser les alertes et la santé globale du homelab.

Les fonctionnalités sont organisées par **priorité** :
- **MVP** : à développer en premier.
- **V2** : itérations une fois le MVP stable.
- **V3+** : fonctionnalités avancées / nice-to-have.

---

## 1. Tableau de bord global (Home)

### Objectif
Vue synthèse de l’état du homelab dès l’ouverture de NexBoard.

### Fonctionnalités

- **Vue synthèse cluster** (**MVP**)
  - Nombre de nœuds Proxmox (online / offline).
  - Nombre de VMs / LXC (running / stopped).
  - Utilisation globale CPU / RAM / stockage du cluster.
  - Indicateur de statut Proxmox API (OK / KO).

- **Événements récents** (**MVP**)
  - Liste des derniers événements importants (VM démarrée/arrêtée, node down, backup fail…).
  - Horodatage + type d’événement.

- **Alertes critiques** (**V2**)
  - Bloc “Alerte” avec les problèmes actifs (disque plein, node offline, backup raté…).

- **Quick actions** (**V2**)
  - Boutons : créer une VM/LXC, ouvrir la liste des VMs, lancer un backup rapide, ouvrir la page “Cluster”.

- **Résumé services homelab** (pfSense, Pi-hole, NPM…) (**V3**)
  - Statut UP/DOWN des services clés avec lien pour ouvrir l’interface web.

---

## 2. Gestion du cluster Proxmox

### Objectif
Afficher les informations de haut niveau de tous les nœuds Proxmox.

### Fonctionnalités

- **Liste des nœuds** (**MVP**)
  - Nom, état (online/offline), version Proxmox, uptime.
  - CPU / RAM utilisés par nœud.
  - Bouton pour ouvrir la page détail du nœud.

- **Détail d’un nœud** (**MVP**)
  - CPU, RAM, stockage utilisé vs total.
  - Liste des VMs / LXC hébergées.
  - Stockages attachés à ce nœud.

- **Heatmap des ressources** (**V2**)
  - Vue graphique montrant la charge CPU/RAM des nœuds pour repérer ceux surchargés.

- **Actions sur nœud** (avec confirmation) (**V3**)
  - Reboot nœud.
  - Mettre le nœud en maintenance (marqueur côté NexBoard).

---

## 3. VMs & LXC — Inventaire complet

### Objectif
Une seule page pour gérer toutes les VMs/LXC.

### Fonctionnalités

- **Liste globale VMs/LXC** (**MVP**)
  - Colonnes : ID, nom, type (VM/LXC), nœud, état (running/stopped), uptime, IP principale, OS (si dispo).
  - Filtre par : nœud, état, type.
  - Barre de recherche (nom / ID).

- **Actions rapides par VM** (**MVP**)  
  - Start / Stop / Reboot (avec confirmation).
  - Accès console : lien vers la console Proxmox (dans un premier temps).
  - Copier commande SSH (ex : `ssh user@ip`).

- **Détail VM/LXC** (**MVP**)
  - Informations : nœud, stockage, vCPU, RAM, disques, interfaces réseau, IPs.
  - Graphiques simples : CPU / RAM / réseau en temps quasi réel (via Prometheus).

- **Tags / rôles de VM** (ex : `prod`, `dev`, `infra`) (**V2**)
  - Ajout de tags dans NexBoard.
  - Filtre par tag.

- **Lien vers service web** (**V2**)
  - Champ “URL de service” par VM (stocké dans NexBoard).
  - Bouton “Ouvrir le service” (ex : TripShare, NPM, Pi-hole).

- **Snapshots (vue simple)** (**V3**)
  - Liste des snapshots Proxmox d’une VM.
  - Actions : créer / supprimer snapshot.

---

## 4. Templates, ISO & déploiement rapide

### Objectif
Simplifier la création et le clonage de VMs/LXC.

### Fonctionnalités

- **Liste des templates & ISO** (**V2**)
  - Templates Proxmox disponibles (nom, type, nœud, storage).
  - ISO : nom, taille, storage.

- **Création rapide de VM/LXC** (**V2**)
  - Formulaire : choix template, nœud, storage, vCPU, RAM, disque, bridge réseau, tags.
  - Bouton “Créer VM”.

- **Clonage de VM** (**V2/V3**)
  - Depuis une VM existante : créer un clone (linked/full) avec nouveau nom + nœud cible.

---

## 5. Stockage & Backups

### Objectif
Suivre la santé et la capacité des stockages, visualiser les backups.

### Fonctionnalités

- **Liste des storages** (**MVP**)
  - Nom, type (LVM-Thin, ZFS, NFS…), capacité totale, utilisé, libre (%).
  - Indicateurs de saturation (ex : >80% : warning, >90% : critical).

- **Détail storage** (**V2**)
  - Liste des VMs/volumes utilisant ce storage.
  - Graphique d’évolution d’utilisation (via Prometheus si dispo).

- **Backups par VM** (**V2**)
  - Liste des backups Proxmox (ou PBS) pour une VM.
  - Infos : date, taille, type, storage cible.

- **Actions backup** (**V2/V3**)
  - Lancer un backup manuel d’une VM.
  - Restaurer un backup sur une nouvelle VM (workflow basique).

---

## 6. Réseau & Topologie

### Objectif
Donner une vue claire des réseaux et IPs du homelab.

### Fonctionnalités

- **Liste des bridges/VLAN** (**MVP light / V2**)
  - Ex : vmbr0 (LAN), vmbr1 (DMZ).
  - Nombre de VMs par bridge.

- **IPs des VMs/LXC** (**MVP**)
  - Dans la fiche VM + dans la liste globale.
  - Identification rapide LAN/DMZ (ex : 192.168.x vs 10.10.x).

- **Topologie logique (cluster, LAN, DMZ)** (**V3**)
  - Schéma simplifié montrant nœuds, réseaux et quelques VMs clés.

- **Stats réseau** (**V2/V3**)
  - Graphiques du trafic réseau par VM/nœud (via Prometheus).

---

## 7. Monitoring (Prometheus)

### Objectif
Afficher des métriques détaillées du cluster et des VMs.

### Fonctionnalités

- **Connexion à Prometheus** (**MVP**)
  - Configuration de l’URL Prometheus dans les paramètres NexBoard.
  - Test de connexion.

- **Métriques cluster** (**MVP**)
  - Graphiques CPU/RAM globales du cluster.
  - Possibilité de choisir la période (ex : 1h / 24h).

- **Métriques nœud** (**MVP/V2**)
  - CPU, RAM, disque, réseau d’un nœud.

- **Métriques VM/LXC** (**MVP/V2**)
  - CPU, RAM, réseau (basique en MVP, plus avancé en V2).

- **Personnalisation des périodes & résolution** (**V2**)
  - Périodes : 1h, 24h, 7j, 30j.
  - Pré-sets de dashboards (Cluster / Nœuds / VMs).

---

## 8. Alertes & Notifications

### Objectif
Centraliser les problèmes et notifier l’utilisateur.

### Fonctionnalités

- **Centre d’alertes** (**MVP light / V2**)
  - Liste des alertes actives : type, gravité, horodatage.
  - Types : node down, VM down, disque saturé, backup fail…

- **Seuils internes NexBoard** (**V2**)
  - Ex : RAM > 90%, disque > 85%, CPU > 90% pendant X minutes.

- **Notifications email** (**V2/V3**)
  - Configuration SMTP.
  - Envoi d’emails pour les alertes critiques.

- **Notifications webhook (Discord, Slack, Teams…)** (**V3**)

---

## 9. Logs & Audit

### Objectif
Voir ce qui se passe sur le cluster et ce qui a été fait via NexBoard.

### Fonctionnalités

- **Journal des événements Proxmox simplifié** (**V2**)
  - Start/stop VM, migrations, erreurs, etc.

- **Audit des actions NexBoard** (**V2/V3**)
  - Qui a fait quoi : start/stop VM, modification paramètres…
  - Filtre par utilisateur, date, type d’action.

---

## 10. Automatisation & Scripts

### Objectif
Permettre des actions groupées pour le homelab.

### Fonctionnalités

- **Playbooks prédéfinis** (**V3**)
  - Arrêt propre de toutes les VMs (maintenance).
  - Redémarrage contrôlé du cluster.
  - Snapshot + backup de VMs critiques.

- **Scripts custom** (**V3+**)
  - Définir des scripts shell/Ansible exécutables depuis NexBoard.
  - Sélection des nœuds/VMs cibles.

- **Planification (scheduler)** (**V3+**)
  - Lancer un job tous les jours/semaines (snapshot, cleanup…).

---

## 11. Intégrations Homelab (pfSense, Pi-hole, NPM…)

### Objectif
Avoir un résumé de l’état des services critiques autour de Proxmox.

### Fonctionnalités

- **pfSense** (**V2/V3**)
  - Statut UP/DOWN.
  - WAN IP.
  - CPU/RAM (via exporter ou API).

- **Pi-hole / AdGuard** (**V2/V3**)
  - UP/DOWN.
  - Requêtes bloquées (stats de base).

- **Nginx Proxy Manager / Traefik** (**V2/V3**)
  - Liste des hosts exposés (domaines).
  - Indication certificat SSL OK/expiré.

- **Autres services (Plex, qBittorrent, Radarr/Sonarr…)** (**V3+**)
  - Ping/healthcheck basique.
  - Lien pour ouvrir l’interface web.

---

## 12. Sécurité & Comptes

### Objectif
Contrôler l’accès à NexBoard.

### Fonctionnalités

- **Authentification simple** (**MVP**)
  - Login/password admin stocké côté backend.
  - Formulaire de connexion.

- **Multiples comptes + rôles (RBAC)** (**V2**)
  - Rôle Admin : accès total.
  - Rôle Ops : actions sur VMs, pas sur la config globale.
  - Rôle Read-only : lecture seule.

- **SSO / OAuth2 (Keycloak, etc.)** (**V3**)

- **Gestion des API keys** (**V3+**)
  - Clés pour que d’autres outils puissent appeler NexBoard.

---

## 13. Paramètres & Qualité de vie (UX)

### Objectif
Adapter NexBoard à ton environnement et améliorer le confort.

### Fonctionnalités

- **Paramètres généraux** (**MVP**)
  - URL/API Proxmox.
  - URL Prometheus.
  - Timezone, langue (FR/EN).
  - Test de connexion aux services.

- **Thème & UI** (**MVP/V2**)
  - Dark / Light mode.
  - Accent color configurable (plus tard).

- **Page “Healthcheck NexBoard”** (**MVP**)
  - Version front / back.
  - Statut connexion Proxmox / Prometheus / DB.

- **Mode démo (masquer certaines infos sensibles)** (**V3**)

---

## 14. Priorisation globale

- **MVP (version 1)**  
  - Authentification simple (admin).
  - Connexion Proxmox + récupération :
    - Cluster (nœuds).
    - VMs/LXC (liste + détail).
    - Storages (capacités).
  - Dashboard global simple (stats cluster + événements récents).
  - Monitoring de base via Prometheus (cluster + quelques métriques VM/nœud).
  - Page paramètres (config Proxmox + Prometheus).
  - Dark mode de base.

- **V2**  
  - Tags VM, actions rapides, création rapide VM/LXC.
  - Backups (vue + lancement manuel).
  - Alertes internes NexBoard (seuils).
  - Intégration pfSense/Pi-hole/NPM (statuts simples).
  - RBAC (plusieurs comptes / rôles).
  - Logs & audit simples.

- **V3+**  
  - Automatisation / playbooks / scheduler.
  - Webhooks / intégrations externes (Discord, Slack…).
  - Topologie réseau visuelle avancée.
  - SSO / OAuth2.
  - Mode démo + fonctionnalités “showcase”.

