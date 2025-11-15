import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Server, Monitor, Container, Activity, HardDrive, Network, Cpu, MemoryStick, AlertTriangle, RefreshCw, Archive, Zap, Clock } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { apiPost } from '@/utils/api';
import { storage } from '@/utils/storage';

export function Overview() {
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    nodes: { total: 0, online: 0, offline: 0, maintenance: 0 },
    vms: { total: 0, running: 0, stopped: 0 },
    lxc: { total: 0, running: 0, stopped: 0 },
    docker: { total: 0, running: 0, stopped: 0 },
    storage: { used: 0, total: 0, usedGB: 0 }, // used = pourcentage, total = GB total, usedGB = GB utilisé
    network: { interfaces: 0, active: 0 },
    cluster: { cpu: 0, memory: 0, disk: 0 },
  });

  const [refreshing, setRefreshing] = useState(false);
  const [recentEvents, setRecentEvents] = useState<Array<{
    id: string;
    type: 'vm_started' | 'vm_stopped' | 'lxc_started' | 'lxc_stopped' | 'node_online' | 'node_offline' | 'backup_completed' | 'backup_failed';
    title: string;
    message: string;
    timestamp: Date;
    severity: 'info' | 'warning' | 'critical';
  }>>([]);

  // Charger les événements récents depuis Proxmox et localStorage
  const loadRecentEvents = async () => {
    try {
      // Charger les tâches Proxmox pour créer des événements réels
      const config = localStorage.getItem('proxmoxConfig');
      let proxmoxEvents: any[] = [];
      
      if (config) {
        try {
          const proxmoxConfig = JSON.parse(config);
          const tasksData = await apiPost<{
            success: boolean;
            message?: string;
            tasks?: any[];
          }>('/api/v1/proxmox/fetch-tasks', proxmoxConfig);
          
          if (tasksData.success && tasksData.tasks) {
            // Convertir les tâches Proxmox en événements
            proxmoxEvents = tasksData.tasks
              .filter((task: any) => {
                // Filtrer les tâches récentes (dernières 7 jours) et importantes
                const taskDate = new Date(task.started_at || task.created_at);
                if (isNaN(taskDate.getTime())) return false;
                const daysAgo = (Date.now() - taskDate.getTime()) / (1000 * 60 * 60 * 24);
                if (daysAgo > 7) return false;
                
                // Vérifier le type dans task.type ou task.id (Proxmox utilise parfois id pour le type)
                const taskType = (task.type || task.id || '').toLowerCase();
                const taskId = (task.id || task.name || '').toLowerCase();
                
                return (
                  taskType.includes('vzdump') || taskId.includes('vzdump') || // Backups
                  taskType.includes('qmstart') || taskId.includes('qmstart') || // VM start
                  taskType.includes('qmstop') || taskId.includes('qmstop') || // VM stop
                  taskType.includes('lxcstart') || taskId.includes('lxcstart') || // LXC start
                  taskType.includes('lxcstop') || taskId.includes('lxcstop') || // LXC stop
                  taskType.includes('migrate') || taskId.includes('migrate') || // Migrations
                  task.status === 'failed' // Échecs
                );
              })
              .map((task: any) => {
                const taskDate = new Date(task.started_at || task.created_at);
                if (isNaN(taskDate.getTime())) return null;
                
                // Vérifier le type dans task.type ou task.id
                const taskType = (task.type || task.id || '').toLowerCase();
                const taskId = (task.id || task.name || '').toLowerCase();
                const taskName = task.name || task.id || 'inconnu';
                
                let type: 'vm_started' | 'vm_stopped' | 'lxc_started' | 'lxc_stopped' | 'node_online' | 'node_offline' | 'backup_completed' | 'backup_failed';
                let title = '';
                let message = '';
                let severity: 'info' | 'warning' | 'critical' = 'info';
                
                // Déterminer le type d'événement selon le type de tâche
                if (taskType.includes('qmstart') || taskId.includes('qmstart')) {
                  type = 'vm_started';
                  title = `VM ${taskName} démarrée`;
                  message = `La VM ${taskName} a été démarrée sur ${task.node || 'N/A'}`;
                  severity = 'info';
                } else if (taskType.includes('qmstop') || taskId.includes('qmstop')) {
                  type = 'vm_stopped';
                  title = `VM ${taskName} arrêtée`;
                  message = `La VM ${taskName} a été arrêtée sur ${task.node || 'N/A'}`;
                  severity = 'warning';
                } else if (taskType.includes('lxcstart') || taskId.includes('lxcstart')) {
                  type = 'lxc_started';
                  title = `LXC ${taskName} démarré`;
                  message = `Le conteneur LXC ${taskName} a été démarré sur ${task.node || 'N/A'}`;
                  severity = 'info';
                } else if (taskType.includes('lxcstop') || taskId.includes('lxcstop')) {
                  type = 'lxc_stopped';
                  title = `LXC ${taskName} arrêté`;
                  message = `Le conteneur LXC ${taskName} a été arrêté sur ${task.node || 'N/A'}`;
                  severity = 'warning';
                } else if (taskType.includes('vzdump') || taskId.includes('vzdump')) {
                  if (task.status === 'completed') {
                    type = 'backup_completed';
                    title = `Backup ${taskName} terminé`;
                    message = `Le backup ${taskName} s'est terminé avec succès sur ${task.node || 'N/A'}`;
                    severity = 'info';
                  } else if (task.status === 'failed') {
                    type = 'backup_failed';
                    title = `Backup ${taskName} échoué`;
                    message = `Le backup ${taskName} a échoué sur ${task.node || 'N/A'}`;
                    severity = 'critical';
                  } else {
                    // Tâche en cours ou autre statut
                    type = 'backup_completed';
                    title = `Backup ${taskName} en cours`;
                    message = `Le backup ${taskName} est en cours sur ${task.node || 'N/A'}`;
                    severity = 'info';
                  }
                } else {
                  // Autres types de tâches - ignorer si pas important
                  return null;
                }
                
                return {
                  id: `task-${task.id || task.name || Date.now()}`,
                  type,
                  title,
                  message,
                  timestamp: taskDate,
                  severity
                };
              })
              .filter((event: any) => event !== null); // Filtrer les null
          }
        } catch (err) {
          console.warn('⚠️ Erreur lors du chargement des tâches Proxmox (non bloquant):', err);
        }
      }
      
      // Combiner avec les événements générés depuis les données (changements de statut)
      const dataEvents = generateEventsFromData();
      
      // Fusionner et trier par date
      const allEvents = [...proxmoxEvents, ...dataEvents]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 20); // Garder les 20 plus récents
      
      // Supprimer les doublons (même ID)
      const uniqueEvents = Array.from(
        new Map(allEvents.map(event => [event.id, event])).values()
      ).slice(0, 10); // Garder les 10 plus récents après déduplication
      
      setRecentEvents(uniqueEvents);
      localStorage.setItem('proxmoxEvents', JSON.stringify(uniqueEvents));
    } catch (err) {
      console.error('Erreur lors du chargement des événements:', err);
      // Fallback : générer depuis les données
      generateEventsFromData();
    }
  };

  // Générer des événements à partir des données Proxmox (changements de statut)
  const generateEventsFromData = (): Array<{
    id: string;
    type: 'vm_started' | 'vm_stopped' | 'lxc_started' | 'lxc_stopped' | 'node_online' | 'node_offline' | 'backup_completed' | 'backup_failed';
    title: string;
    message: string;
    timestamp: Date;
    severity: 'info' | 'warning' | 'critical';
  }> => {
    const events: Array<{
      id: string;
      type: 'vm_started' | 'vm_stopped' | 'lxc_started' | 'lxc_stopped' | 'node_online' | 'node_offline' | 'backup_completed' | 'backup_failed';
      title: string;
      message: string;
      timestamp: Date;
      severity: 'info' | 'warning' | 'critical';
    }> = [];

    try {
      const savedVMs = localStorage.getItem('proxmoxVMs');
      const savedLXC = localStorage.getItem('proxmoxLXC');
      const savedNodes = localStorage.getItem('proxmoxNodes');

      if (savedVMs) {
        const vms = JSON.parse(savedVMs);
        vms.forEach((vm: any) => {
          if (vm.status === 'running') {
            events.push({
              id: `vm-${vm.id}-started`,
              type: 'vm_started',
              title: `VM ${vm.name || vm.id} démarrée`,
              message: `La VM ${vm.name || vm.id} est en cours d'exécution sur ${vm.node || 'N/A'}`,
              timestamp: new Date(vm.last_update || Date.now()),
              severity: 'info'
            });
          } else {
            events.push({
              id: `vm-${vm.id}-stopped`,
              type: 'vm_stopped',
              title: `VM ${vm.name || vm.id} arrêtée`,
              message: `La VM ${vm.name || vm.id} est arrêtée`,
              timestamp: new Date(vm.last_update || Date.now()),
              severity: 'warning'
            });
          }
        });
      }

      if (savedLXC) {
        const lxc = JSON.parse(savedLXC);
        lxc.forEach((container: any) => {
          if (container.status === 'running') {
            events.push({
              id: `lxc-${container.id}-started`,
              type: 'lxc_started',
              title: `LXC ${container.name || container.id} démarré`,
              message: `Le conteneur LXC ${container.name || container.id} est en cours d'exécution`,
              timestamp: new Date(container.last_update || Date.now()),
              severity: 'info'
            });
          }
        });
      }

      if (savedNodes) {
        const nodes = JSON.parse(savedNodes);
        nodes.forEach((node: any) => {
          if (node.status === 'online') {
            events.push({
              id: `node-${node.name}-online`,
              type: 'node_online',
              title: `Nœud ${node.name} en ligne`,
              message: `Le nœud ${node.name} est opérationnel`,
              timestamp: new Date(node.last_update || Date.now()),
              severity: 'info'
            });
          } else {
            events.push({
              id: `node-${node.name}-offline`,
              type: 'node_offline',
              title: `Nœud ${node.name} hors ligne`,
              message: `Le nœud ${node.name} est hors ligne`,
              timestamp: new Date(node.last_update || Date.now()),
              severity: 'critical'
            });
          }
        });
      }

      // Retourner les événements (seront triés dans loadRecentEvents)
      return events;
    } catch (err) {
      console.error('Erreur lors de la génération des événements:', err);
      return [];
    }
  };

  // Charger les statistiques depuis localStorage avec données réelles
  const loadStats = () => {
    try {

      // Charger les nœuds
      const savedNodes = localStorage.getItem('proxmoxNodes');
      const nodes = savedNodes ? JSON.parse(savedNodes) : [];

      // Charger les VMs
      const savedVMs = localStorage.getItem('proxmoxVMs');
      const vms = savedVMs ? JSON.parse(savedVMs) : [];

      // Charger les conteneurs LXC
      const savedLXC = localStorage.getItem('proxmoxLXC');
      const lxc = savedLXC ? JSON.parse(savedLXC) : [];

      // Charger les storages (vraies données Proxmox)
      const savedStorages = localStorage.getItem('proxmoxStorages');
      const storages = savedStorages ? JSON.parse(savedStorages) : [];

      // Charger les interfaces réseau (vraies données Proxmox)
      const savedNetworks = localStorage.getItem('proxmoxNetworks');
      const networks = savedNetworks ? JSON.parse(savedNetworks) : [];

      // Charger les conteneurs Docker depuis localStorage
      // Les données Docker sont chargées via fetch-docker et sauvegardées dans localStorage
      const savedDocker = localStorage.getItem('proxmoxDocker');
      let docker: any[] = [];
      
      if (savedDocker) {
        try {
          docker = JSON.parse(savedDocker);
        } catch (err) {
          console.error('Erreur parsing Docker data:', err);
        }
      }

      console.log('📊 Données Overview chargées:', { 
        nodes: { count: nodes.length, sample: nodes[0] },
        vms: { count: vms.length, sample: vms[0], allStatuses: [...new Set(vms.map((v: any) => v.status))] },
        lxc: { count: lxc.length, sample: lxc[0], allStatuses: [...new Set(lxc.map((c: any) => c.status))] },
        docker: { count: docker.length, sample: docker[0] },
        storages: { count: storages.length, sample: storages[0] },
        networks: { count: networks.length, sample: networks[0] }
      });
      
      // Log détaillé des VMs et LXC pour déboguer
      if (vms.length > 0) {
        console.log('🖥️ VMs détaillées:', vms.map((v: any) => ({ id: v.id || v.vmid, name: v.name, status: v.status })));
      } else {
        console.warn('⚠️ Aucune VM trouvée dans localStorage');
      }
      
      if (lxc.length > 0) {
        console.log('🐳 LXC détaillés:', lxc.map((c: any) => ({ id: c.id || c.vmid, name: c.name, status: c.status })));
      } else {
        console.warn('⚠️ Aucun LXC trouvé dans localStorage');
      }

      // Calculer les statistiques des nœuds
      const onlineNodes = nodes.filter((n: any) => n.status === 'online');
      const offlineNodes = nodes.filter((n: any) => n.status === 'offline');
      const maintenanceNodes = nodes.filter((n: any) => n.status === 'maintenance');
      
      console.log('📊 Statistiques nœuds calculées:', {
        total: nodes.length,
        online: onlineNodes.length,
        offline: offlineNodes.length,
        maintenance: maintenanceNodes.length
      });

      // Calculer les moyennes du cluster
      let totalCpu = 0, totalMemory = 0, totalDisk = 0;
      if (nodes.length > 0) {
        nodes.forEach((node: any) => {
          totalCpu += node.cpu_usage || 0;
          totalMemory += node.memory_usage || 0;
          totalDisk += node.disk_usage || 0;
        });
      }

      // Calculer le stockage total du cluster depuis les vraies données Proxmox
      // Les données de stockage Proxmox incluent déjà l'utilisation par les VMs, LXC, etc.
      let totalStorageUsed = 0, totalStorageTotal = 0;
      const storageMap = new Map<string, boolean>(); // Pour éviter les doublons de storages partagés
      
      if (storages.length > 0) {
        storages.forEach((storage: any) => {
          const storageId = storage.id || storage.name || 'unknown';
          
          // Les storages partagés (NFS, Ceph, iSCSI) ne doivent être comptés qu'une fois
          // Les storages locaux (local, local-lvm) sont différents sur chaque nœud et doivent être additionnés
          const isSharedStorage = storage.type === 'nfs' || storage.type === 'ceph' || storage.type === 'iscsi';
          
          if (isSharedStorage && storageMap.has(storageId)) {
            // Storage partagé déjà compté, on le skip
            return;
          }
          
          storageMap.set(storageId, true);
          
          // Les données sont déjà en GB depuis le backend (conversion faite dans handlers.go)
          const totalSpace = parseFloat(storage.total_space) || 0;
          const usedSpace = parseFloat(storage.used_space) || 0;
          
          // S'assurer que les valeurs sont valides et cohérentes
          if (totalSpace > 0 && usedSpace >= 0 && usedSpace <= totalSpace) {
            totalStorageTotal += totalSpace;
            totalStorageUsed += usedSpace;
          } else {
            console.warn('⚠️ Données de stockage invalides pour', storageId, { 
              totalSpace, 
              usedSpace, 
              raw: { 
                total_space: storage.total_space, 
                used_space: storage.used_space 
              } 
            });
          }
        });
        
        console.log('💾 Stockage calculé:', {
          storages: storages.length,
          unique: storageMap.size,
          totalGB: totalStorageTotal.toFixed(2),
          usedGB: totalStorageUsed.toFixed(2),
          percent: totalStorageTotal > 0 ? ((totalStorageUsed / totalStorageTotal) * 100).toFixed(2) : 0
        });
      } else {
        // En production, ne pas utiliser de fallback - les données doivent provenir de Proxmox
        const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';
        if (isProduction) {
          console.warn('⚠️ Production: Aucune donnée de stockage Proxmox trouvée. Veuillez configurer Proxmox et rafraîchir les données.');
        } else {
          console.warn('⚠️ Développement: Aucune donnée de stockage trouvée');
        }
      }

      // Calculer le pourcentage d'utilisation du stockage (ne pas dépasser 100%)
      const storageUsagePercent = totalStorageTotal > 0 
        ? Math.min(100, Math.round((totalStorageUsed / totalStorageTotal) * 100))
        : 0;

      // Calculer les statistiques réseau depuis les vraies données
      let activeNetworks = 0;
      let totalNetworks = 0;
      
      if (networks && networks.length > 0) {
        // Utiliser les vraies données réseau
        activeNetworks = networks.filter((n: any) => {
          const status = String(n.status || '').toLowerCase();
          const isActive = n.active === true || n.active === 1;
          return status === 'active' || status === 'up' || isActive;
        }).length;
        totalNetworks = networks.length;
        console.log('🌐 Statistiques réseau calculées:', {
          total: totalNetworks,
          active: activeNetworks,
          networks: networks.map((n: any) => ({ name: n.name, status: n.status, active: n.active }))
        });
      } else {
        // Fallback : si pas de données réseau, utiliser le nombre de nœuds en ligne
        // (chaque nœud a généralement au moins une interface réseau)
        totalNetworks = onlineNodes.length;
        activeNetworks = onlineNodes.length; // On suppose que les nœuds en ligne ont des interfaces actives
        console.warn('⚠️ Aucune donnée réseau trouvée, utilisation du fallback:', { totalNetworks, activeNetworks });
      }

      const statsData = {
        nodes: {
          total: nodes.length,
          online: onlineNodes.length,
          offline: offlineNodes.length,
          maintenance: maintenanceNodes.length,
        },
        vms: {
          total: vms.length,
          running: vms.filter((v: any) => {
            const status = String(v.status || '').toLowerCase();
            // Proxmox peut retourner différents statuts : running, stopped, paused, suspended, etc.
            return status === 'running';
          }).length,
          stopped: vms.filter((v: any) => {
            const status = String(v.status || '').toLowerCase();
            // Inclure tous les statuts non-running comme stopped
            return status !== 'running' && status !== '';
          }).length,
        },
        lxc: {
          total: lxc.length,
          running: lxc.filter((c: any) => {
            const status = String(c.status || '').toLowerCase();
            // Proxmox peut retourner différents statuts : running, stopped, paused, suspended, etc.
            return status === 'running';
          }).length,
          stopped: lxc.filter((c: any) => {
            const status = String(c.status || '').toLowerCase();
            // Inclure tous les statuts non-running comme stopped
            return status !== 'running' && status !== '';
          }).length,
        },
        docker: {
          total: docker.length,
          running: docker.filter((d: any) => {
            const status = String(d.status || '').toLowerCase();
            return status === 'running';
          }).length,
          stopped: docker.filter((d: any) => {
            const status = String(d.status || '').toLowerCase();
            return status !== 'running' && status !== '';
          }).length,
        },
        storage: {
          used: storageUsagePercent, // Pourcentage pour l'affichage
          total: totalStorageTotal, // Total en GB pour le calcul
          usedGB: totalStorageUsed // Utilisé en GB pour l'affichage
        },
        network: { 
          interfaces: totalNetworks, 
          active: activeNetworks 
        },
        cluster: {
          cpu: nodes.length > 0 ? Math.round(totalCpu / nodes.length) : 0,
          memory: nodes.length > 0 ? Math.round(totalMemory / nodes.length) : 0,
          disk: nodes.length > 0 ? Math.round(totalDisk / nodes.length) : 0,
        },
      };
      
      console.log('📊 Statistiques finales calculées:', statsData);
      console.log('📊 Détail VMs/LXC:', {
        vmsTotal: vms.length,
        vmsRunning: statsData.vms.running,
        vmsStopped: statsData.vms.stopped,
        vmsStatuses: vms.map((v: any) => ({ name: v.name, status: v.status })),
        lxcTotal: lxc.length,
        lxcRunning: statsData.lxc.running,
        lxcStopped: statsData.lxc.stopped,
        lxcStatuses: lxc.map((c: any) => ({ name: c.name, status: c.status }))
      });
      setStats(statsData);
    } catch (err) {
      console.error('❌ Erreur lors du chargement des statistiques:', err);
    }
  };

  // Rafraîchir les données depuis Proxmox
  const refreshData = async () => {
    try {
      setRefreshing(true);

      // Récupérer la configuration Proxmox
      const config = localStorage.getItem('proxmoxConfig');
      if (!config) {
        console.log('⚠️ Aucune configuration Proxmox trouvée');
        return;
      }

      const proxmoxConfig = JSON.parse(config);

      // Appeler l'API backend pour récupérer les données
      // Utiliser apiPost pour utiliser la bonne URL de l'API (API_BASE_URL)
      const data = await apiPost<{
        success: boolean;
        message?: string;
        nodes?: any[];
        vms?: any[];
        lxc?: any[];
        storages?: any[];
        networks?: any[];
      }>('/api/v1/proxmox/fetch-data', proxmoxConfig);

      console.log('📥 Réponse complète du backend:', {
        success: data.success,
        message: data.message,
        nodesCount: data.nodes?.length || 0,
        vmsCount: data.vms?.length || 0,
        lxcCount: data.lxc?.length || 0,
        storagesCount: data.storages?.length || 0,
        networksCount: data.networks?.length || 0,
        nodesSample: data.nodes?.[0],
        vmsSample: data.vms?.[0],
        lxcSample: data.lxc?.[0],
        storagesSample: data.storages?.[0],
        networksSample: data.networks?.[0]
      });

      if (data.success) {
        // Sauvegarder les nouvelles données
        const nodesData = data.nodes || [];
        const vmsData = data.vms || [];
        const lxcData = data.lxc || [];
        const storagesData = data.storages || [];
        const networksData = data.networks || [];
        
        console.log('💾 Sauvegarde des données dans localStorage:', {
          nodes: nodesData.length,
          vms: vmsData.length,
          lxc: lxcData.length,
          storages: storagesData.length,
          networks: networksData.length
        });
        
        // Toujours sauvegarder, même si vide, pour éviter les anciennes données obsolètes
        localStorage.setItem('proxmoxNodes', JSON.stringify(nodesData));
        localStorage.setItem('proxmoxVMs', JSON.stringify(vmsData));
        localStorage.setItem('proxmoxLXC', JSON.stringify(lxcData));
        
        if (storagesData.length > 0) {
          localStorage.setItem('proxmoxStorages', JSON.stringify(storagesData));
          console.log('💾 Storages sauvegardés:', storagesData.length, 'storages');
        } else {
          console.warn('⚠️ Aucune donnée de stockage dans la réponse - nettoyage localStorage');
          localStorage.removeItem('proxmoxStorages'); // Nettoyer les anciennes données
        }
        
        // Toujours sauvegarder les données réseau, même si vides
        localStorage.setItem('proxmoxNetworks', JSON.stringify(networksData));
        if (networksData.length > 0) {
          console.log('🌐 Réseaux sauvegardés:', networksData.length, 'interfaces');
        } else {
          console.warn('⚠️ Aucune donnée réseau dans la réponse - sauvegarde d\'un tableau vide');
        }

        console.log('✅ Données Proxmox rafraîchies avec succès:', {
          nodes: nodesData.length,
          vms: vmsData.length,
          lxc: lxcData.length,
          storages: storagesData.length,
          networks: networksData.length
        });
        
        // Charger aussi les données Docker
        try {
          const dockerData = await apiPost<{
            success: boolean;
            message?: string;
            containers?: any[];
          }>('/api/v1/proxmox/fetch-docker', proxmoxConfig);
          
          if (dockerData.success && dockerData.containers) {
            localStorage.setItem('proxmoxDocker', JSON.stringify(dockerData.containers));
            console.log('🐳 Conteneurs Docker chargés:', dockerData.containers.length);
          }
        } catch (dockerErr) {
          console.warn('⚠️ Erreur lors du chargement Docker (non bloquant):', dockerErr);
        }
        
        // Recharger les statistiques et événements après sauvegarde
        loadStats();
        await loadRecentEvents();
      } else {
        // Afficher le message d'erreur du backend
        const errorMsg = data.message || 'Erreur lors du rafraîchissement des données Proxmox';
        console.error('❌ Erreur Proxmox:', errorMsg);
      }
    } catch (error) {
      console.error('❌ Erreur lors du rafraîchissement:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Charger automatiquement les données Proxmox si la configuration existe
    const loadDataOnMount = async () => {
      await storage.ensureProxmoxDataLoaded();
      
      // Charger aussi les données Docker si pas déjà chargées
      const savedDocker = localStorage.getItem('proxmoxDocker');
      if (!savedDocker) {
        try {
          const config = localStorage.getItem('proxmoxConfig');
          if (config) {
            const proxmoxConfig = JSON.parse(config);
            const dockerData = await apiPost<{
              success: boolean;
              message?: string;
              containers?: any[];
            }>('/api/v1/proxmox/fetch-docker', proxmoxConfig);
            
            if (dockerData.success && dockerData.containers) {
              localStorage.setItem('proxmoxDocker', JSON.stringify(dockerData.containers));
              console.log('🐳 Conteneurs Docker chargés au démarrage:', dockerData.containers.length);
            }
          }
        } catch (dockerErr) {
          console.warn('⚠️ Erreur lors du chargement Docker au démarrage (non bloquant):', dockerErr);
        }
      }
      
      // Charger les statistiques et événements après avoir chargé les données
      loadStats();
      await loadRecentEvents();
    };
    
    loadDataOnMount();
  }, []);

  // Rafraîchissement automatique toutes les 30 secondes
  useEffect(() => {
    const interval = setInterval(async () => {
      await storage.ensureProxmoxDataLoaded();
      loadStats();
      await loadRecentEvents();
    }, 30000); // 30 secondes

    return () => clearInterval(interval);
  }, []);

  // Écouter les mises à jour des données Proxmox
  useEffect(() => {
    const handleProxmoxDataUpdate = async (event: any) => {
      console.log('🔄 Mise à jour des données Proxmox détectée pour Overview', event.detail);
      // Recharger les statistiques et événements immédiatement
      setTimeout(async () => {
        loadStats();
        await loadRecentEvents();
      }, 100); // Petit délai pour s'assurer que localStorage est à jour
    };

    window.addEventListener('proxmoxDataUpdated', handleProxmoxDataUpdate as EventListener);
    return () => window.removeEventListener('proxmoxDataUpdated', handleProxmoxDataUpdate as EventListener);
  }, []);

  // Formater le temps relatif
  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `il y a ${minutes} min`;
    if (hours < 24) return `il y a ${hours}h`;
    return `il y a ${days}j`;
  };

  // Navigation rapide
  const navigateToSection = (section: string) => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: section }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {t('navigation.overview')}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {t('dashboard.title')}
          </p>
        </div>
        <button
          onClick={refreshData}
          disabled={refreshing}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? t('common.loading') : t('common.refresh')}</span>
        </button>
      </div>

      {/* Message informatif si aucune donnée */}
      {((stats.nodes.total === 0 && stats.vms.total === 0 && stats.lxc.total === 0) || 
       (stats.vms.total === 0 && stats.lxc.total === 0 && stats.storage.total === 0)) && (
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                  {stats.nodes.total === 0 ? 'Aucune donnée Proxmox disponible' : 'Données VMs/LXC/Storage manquantes'}
                </h3>
                <div className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                  {stats.nodes.total === 0 ? (
                    <p>Les données n'ont pas encore été chargées depuis Proxmox. Cliquez sur le bouton "Rafraîchir" pour charger les données de votre cluster Proxmox.</p>
                  ) : (
                    <div>
                      <p className="mb-2">Les données VMs, LXC ou Storage semblent manquantes. Vérifiez :</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Que votre cluster Proxmox contient bien des VMs/LXC</li>
                        <li>Que la configuration Proxmox est correcte dans les Paramètres</li>
                        <li>Que les logs du backend ne montrent pas d'erreurs</li>
                        <li>Ouvrez la console du navigateur (F12) pour voir les détails</li>
                      </ul>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button
                    onClick={refreshData}
                    disabled={refreshing}
                    size="sm"
                    variant="outline"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Chargement...' : 'Rafraîchir maintenant'}
                  </Button>
                  <Button
                    onClick={() => {
                      console.log('🔍 État actuel de localStorage:', {
                        nodes: localStorage.getItem('proxmoxNodes') ? JSON.parse(localStorage.getItem('proxmoxNodes')!).length : 0,
                        vms: localStorage.getItem('proxmoxVMs') ? JSON.parse(localStorage.getItem('proxmoxVMs')!).length : 0,
                        lxc: localStorage.getItem('proxmoxLXC') ? JSON.parse(localStorage.getItem('proxmoxLXC')!).length : 0,
                        storages: localStorage.getItem('proxmoxStorages') ? JSON.parse(localStorage.getItem('proxmoxStorages')!).length : 0,
                        networks: localStorage.getItem('proxmoxNetworks') ? JSON.parse(localStorage.getItem('proxmoxNetworks')!).length : 0,
                        config: localStorage.getItem('proxmoxConfig') ? 'présente' : 'manquante'
                      });
                      loadStats();
                    }}
                    size="sm"
                    variant="outline"
                  >
                    🔍 Vérifier localStorage
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Graphiques de performance du cluster */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* CPU du cluster */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.performance')} - CPU</CardTitle>
            <Cpu className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.cluster.cpu}%
            </div>
            <div className="mt-2">
              <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    stats.cluster.cpu > 80 ? 'bg-red-500' :
                    stats.cluster.cpu > 60 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(stats.cluster.cpu, 100)}%` }}
                />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Utilisation moyenne du cluster
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Mémoire du cluster */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.performance')} - {t('nodes.memory_usage')}</CardTitle>
            <MemoryStick className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.cluster.memory}%
            </div>
            <div className="mt-2">
              <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    stats.cluster.memory > 80 ? 'bg-red-500' :
                    stats.cluster.memory > 60 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(stats.cluster.memory, 100)}%` }}
                />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Utilisation moyenne du cluster
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Disque du cluster */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.performance')} - {t('nodes.disk_usage')}</CardTitle>
            <HardDrive className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.cluster.disk}%
            </div>
            <div className="mt-2">
              <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    stats.cluster.disk > 80 ? 'bg-red-500' :
                    stats.cluster.disk > 60 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(stats.cluster.disk, 100)}%` }}
                />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Utilisation moyenne du cluster
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Nœuds */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('navigation.nodes')}</CardTitle>
            <Server className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.nodes.online}/{stats.nodes.total}
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <Badge variant="success" size="sm">
                {stats.nodes.online} {t('nodes.online')}
              </Badge>
              {stats.nodes.offline > 0 && (
                <Badge variant="error" size="sm">
                  {stats.nodes.offline} {t('nodes.offline')}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* VMs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('navigation.vms')}</CardTitle>
            <Monitor className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.vms.running}/{stats.vms.total}
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <Badge variant="success" size="sm">
                {stats.vms.running} {t('vms.running')}
              </Badge>
              {stats.vms.stopped > 0 && (
                <Badge variant="default" size="sm">
                  {stats.vms.stopped} {t('vms.stopped')}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* LXC */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('navigation.lxc')}</CardTitle>
            <Container className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.lxc.running}/{stats.lxc.total}
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <Badge variant="success" size="sm">
                {stats.lxc.running} {t('lxc.running')}
              </Badge>
              {stats.lxc.stopped > 0 && (
                <Badge variant="default" size="sm">
                  {stats.lxc.stopped} {t('lxc.stopped')}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Docker */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conteneurs Docker</CardTitle>
            <Activity className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.docker.running}/{stats.docker.total}
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <Badge variant="success" size="sm">
                {stats.docker.running} actifs
              </Badge>
              {stats.docker.stopped > 0 && (
                <Badge variant="default" size="sm">
                  {stats.docker.stopped} arrêtés
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stockage */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('navigation.storage')}</CardTitle>
            <HardDrive className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.storage.used}%
            </div>
            <div className="mt-2">
              <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    stats.storage.used >= 90 ? 'bg-red-500' :
                    stats.storage.used >= 75 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(stats.storage.used, 100)}%` }}
                />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {(() => {
                  const formatSize = (gb: number) => {
                    if (gb >= 1024) return `${(gb / 1024).toFixed(1)} TB`;
                    return `${gb.toFixed(1)} GB`;
                  };
                  return `${formatSize(stats.storage.usedGB)} / ${formatSize(stats.storage.total)} utilisés`;
                })()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Réseau */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('navigation.network')}</CardTitle>
            <Network className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </CardHeader>
          <CardContent>
            {stats.network.interfaces > 0 ? (
              <>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {stats.network.active}/{stats.network.interfaces}
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  {stats.network.active > 0 && (
                    <Badge variant="success" size="sm">
                      {stats.network.active} {t('common.active') || 'actives'}
                    </Badge>
                  )}
                  {stats.network.interfaces - stats.network.active > 0 && (
                    <Badge variant="default" size="sm">
                      {stats.network.interfaces - stats.network.active} {t('common.inactive') || 'inactives'}
                    </Badge>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  0/0
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  {t('overview.no_network_data') || 'Aucune donnée réseau disponible'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Détails des nœuds avec données réelles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Server className="h-5 w-5" />
            <span>{t('nodes.title')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(() => {
              const savedNodes = localStorage.getItem('proxmoxNodes');
              const nodes = savedNodes ? JSON.parse(savedNodes) : [];

              if (nodes.length === 0) {
                return (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{t('common.no_data') || 'Aucune donnée disponible'}</p>
                    <p className="text-sm">{t('settings.proxmox')} {t('common.configuration') || 'configuration'}</p>
                  </div>
                );
              }

              return nodes.map((node: any) => (
                <div key={node.id} className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        node.status === 'online' ? 'bg-green-500' :
                        node.status === 'offline' ? 'bg-red-500' : 'bg-yellow-500'
                      }`} />
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        {node.name}
                      </h3>
                      <Badge variant={node.status === 'online' ? 'success' : 'error'}>
                        {node.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {node.ip_address}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* CPU */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-600 dark:text-slate-400">CPU</span>
                        <span className="font-medium">{node.cpu_usage || 0}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            (node.cpu_usage || 0) > 80 ? 'bg-red-500' :
                            (node.cpu_usage || 0) > 60 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(node.cpu_usage || 0, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Mémoire */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-600 dark:text-slate-400">Mémoire</span>
                        <span className="font-medium">{node.memory_usage || 0}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            (node.memory_usage || 0) > 80 ? 'bg-red-500' :
                            (node.memory_usage || 0) > 60 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(node.memory_usage || 0, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Disque */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-600 dark:text-slate-400">Disque</span>
                        <span className="font-medium">{node.disk_usage || 0}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            (node.disk_usage || 0) > 80 ? 'bg-red-500' :
                            (node.disk_usage || 0) > 60 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(node.disk_usage || 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Informations détaillées */}
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-600 dark:text-slate-400">Version:</span>
                        <div className="font-mono text-xs mt-1">{node.version || 'N/A'}</div>
                      </div>
                      <div>
                        <span className="text-slate-600 dark:text-slate-400">Uptime:</span>
                        <div className="text-xs mt-1">{node.uptime ? `${Math.floor(node.uptime / 3600)}h` : 'N/A'}</div>
                      </div>
                      <div>
                        <span className="text-slate-600 dark:text-slate-400">VMs:</span>
                        <div className="text-xs mt-1">{node.vms_count || 0}</div>
                      </div>
                      <div>
                        <span className="text-slate-600 dark:text-slate-400">LXC:</span>
                        <div className="text-xs mt-1">{node.lxc_count || 0}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ));
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>{t('overview.quick_actions') || 'Actions rapides'}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Button
              onClick={() => navigateToSection('vms')}
              variant="outline"
              className="flex flex-col items-center space-y-2 h-auto py-4"
            >
              <Monitor className="h-6 w-6" />
              <span className="text-sm">{t('overview.view_vms') || 'Voir les VMs'}</span>
            </Button>
            <Button
              onClick={() => navigateToSection('lxc')}
              variant="outline"
              className="flex flex-col items-center space-y-2 h-auto py-4"
            >
              <Container className="h-6 w-6" />
              <span className="text-sm">{t('overview.view_lxc') || 'Voir les LXC'}</span>
            </Button>
            <Button
              onClick={() => {
                navigateToSection('vms');
                // TODO: Ouvrir modal de création VM
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('createVM'));
                }, 100);
              }}
              variant="outline"
              className="flex flex-col items-center space-y-2 h-auto py-4"
            >
              <Monitor className="h-6 w-6 text-primary-600" />
              <span className="text-sm">{t('overview.create_vm') || 'Créer une VM'}</span>
            </Button>
            <Button
              onClick={() => {
                navigateToSection('lxc');
                // TODO: Ouvrir modal de création LXC
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('createLXC'));
                }, 100);
              }}
              variant="outline"
              className="flex flex-col items-center space-y-2 h-auto py-4"
            >
              <Container className="h-6 w-6 text-primary-600" />
              <span className="text-sm">{t('overview.create_lxc') || 'Créer un LXC'}</span>
            </Button>
            <Button
              onClick={() => navigateToSection('nodes')}
              variant="outline"
              className="flex flex-col items-center space-y-2 h-auto py-4"
            >
              <Server className="h-6 w-6" />
              <span className="text-sm">{t('overview.cluster') || 'Cluster'}</span>
            </Button>
            <Button
              onClick={() => {
                navigateToSection('backups');
                // TODO: Ouvrir modal de lancement backup
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('launchBackup'));
                }, 100);
              }}
              variant="outline"
              className="flex flex-col items-center space-y-2 h-auto py-4"
            >
              <Archive className="h-6 w-6 text-primary-600" />
              <span className="text-sm">{t('overview.launch_backup') || 'Lancer un backup'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Événements récents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>{t('overview.recent_events') || 'Événements récents'}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentEvents.length > 0 ? (
              recentEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-center space-x-3 flex-1">
                    <Badge
                      variant={
                        event.severity === 'critical' ? 'error' :
                        event.severity === 'warning' ? 'warning' : 'info'
                      }
                      size="sm"
                    >
                      {event.type.includes('started') || event.type.includes('online') ? '✓' :
                       event.type.includes('stopped') || event.type.includes('offline') ? '✗' :
                       event.type.includes('completed') ? '✓' : '⚠'}
                    </Badge>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {event.title}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        {event.message}
                      </div>
                    </div>
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap ml-4">
                    {formatTimeAgo(event.timestamp)}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t('overview.no_recent_events') || 'Aucun événement récent'}</p>
                <p className="text-sm">{t('overview.events_will_appear') || 'Les événements apparaîtront ici après les actions sur le cluster'}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alertes récentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5" />
            <span>{t('alerts.critical') || 'Alertes critiques'}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentEvents.filter(e => e.severity === 'critical').length > 0 ? (
              recentEvents
                .filter(e => e.severity === 'critical')
                .slice(0, 5)
                .map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <div className="flex items-center space-x-3">
                      <Badge variant="error" size="sm">
                        {t('alerts.critical')}
                      </Badge>
                      <span className="text-slate-900 dark:text-slate-100">
                        {alert.title}
                      </span>
                    </div>
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {formatTimeAgo(alert.timestamp)}
                    </span>
                  </div>
                ))
            ) : (
              <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                <p className="text-sm">{t('alerts.no_alerts') || 'Aucune alerte'}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
