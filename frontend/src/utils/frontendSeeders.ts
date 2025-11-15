/**
 * Seeders frontend pour l'environnement de développement
 * Charge des données mockées dans localStorage pour Overview, Nodes, et Applications
 */

// Vérifier si on est en mode dev
const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';

/**
 * Seed de la configuration Proxmox fictive pour le développement
 */
export function seedProxmoxConfig() {
  if (!isDev) {
    return; // Ne pas charger en production
  }

  // Vérifier si une configuration existe déjà
  const existingConfig = localStorage.getItem('proxmoxConfig');
  if (existingConfig) {
    console.log('📦 Configuration Proxmox déjà présente, seeder ignoré');
    return;
  }

  console.log('🌱 Chargement de la configuration Proxmox fictive pour le développement...');

  // Configuration Proxmox fictive pour le développement
  const mockProxmoxConfig = {
    url: 'https://proxmox-dev.local:8006',
    username: 'dev-user@pam',
    secret: 'dev-secret-token-12345',
    node: 'pve-01',
    token: 'PVEAPIToken=dev-user@pam!dev-secret-token-12345'
  };

  localStorage.setItem('proxmoxConfig', JSON.stringify(mockProxmoxConfig));
  console.log('✅ Configuration Proxmox fictive seedée:', mockProxmoxConfig);
}

/**
 * Seed de la configuration Prometheus fictive pour le développement
 */
export function seedPrometheusConfig() {
  if (!isDev) {
    return; // Ne pas charger en production
  }

  // Vérifier si une configuration existe déjà
  const existingConfig = localStorage.getItem('prometheusConfig');
  if (existingConfig) {
    console.log('📦 Configuration Prometheus déjà présente, seeder ignoré');
    return;
  }

  console.log('🌱 Chargement de la configuration Prometheus fictive pour le développement...');

  // Configuration Prometheus fictive pour le développement
  const mockPrometheusConfig = {
    url: 'http://prometheus.local:9090'
  };

  localStorage.setItem('prometheusConfig', JSON.stringify(mockPrometheusConfig));
  console.log('✅ Configuration Prometheus fictive seedée:', mockPrometheusConfig);
}

/**
 * Seed des données Proxmox pour le développement
 */
export function seedProxmoxData() {
  if (!isDev) {
    return; // Ne pas charger en production
  }

  // Seed la configuration Proxmox fictive d'abord
  seedProxmoxConfig();
  
  // Seed la configuration Prometheus fictive
  seedPrometheusConfig();

  // Vérifier si des données existent déjà
  const existingNodes = localStorage.getItem('proxmoxNodes');
  const existingVMs = localStorage.getItem('proxmoxVMs');
  const existingLXC = localStorage.getItem('proxmoxLXC');
  const existingEvents = localStorage.getItem('proxmoxEvents');
  const existingStorages = localStorage.getItem('proxmoxStorages');

  if (existingNodes && existingVMs && existingLXC && existingStorages) {
    console.log('📦 Données Proxmox déjà présentes, seeders ignorés');
    return;
  }

  console.log('🌱 Chargement des seeders frontend pour le développement...');

  // Seed des nœuds Proxmox
  if (!existingNodes) {
    const mockNodes = [
      {
        id: 'pve-01',
        name: 'pve-01',
        status: 'online',
        cpu_usage: 45,
        memory_usage: 68,
        disk_usage: 72,
        uptime: 2592000, // 30 jours
        temperature: 42,
        vms_count: 8,
        lxc_count: 12,
        last_update: new Date().toISOString(),
        version: '8.1.4',
        ip_address: '192.168.1.10',
        cpuinfo: '6 x Intel(R) Core(TM) i5-8500T CPU @ 2.10GHz (1 Support de processeur)',
        kversion: 'Linux 6.14.11-1-pve (2025-08-26T16:06Z)',
        loadavg: '0.70, 0.55, 0.34',
        swapinfo: '8.40% (654.18 MiB sur 7.61 GiB)',
        meminfo: '5.18 GiB sur 7.61 GiB',
        diskinfo: '70.45 GiB sur 97.87 GiB',
        vms: [
          { id: 101, name: 'web-server-01', status: 'running' },
          { id: 102, name: 'db-server-01', status: 'running' },
          { id: 103, name: 'app-server-01', status: 'stopped' }
        ],
        lxc: [
          { id: 201, name: 'nginx-proxy', status: 'running' },
          { id: 202, name: 'redis-cache', status: 'running' }
        ]
      },
      {
        id: 'pve-02',
        name: 'pve-02',
        status: 'online',
        cpu_usage: 32,
        memory_usage: 55,
        disk_usage: 65,
        uptime: 2592000,
        temperature: 38,
        vms_count: 5,
        lxc_count: 8,
        last_update: new Date().toISOString(),
        version: '8.1.4',
        ip_address: '192.168.1.11',
        cpuinfo: '4 x AMD Ryzen 5 3600 CPU @ 3.60GHz',
        kversion: 'Linux 6.14.11-1-pve (2025-08-26T16:06Z)',
        loadavg: '0.45, 0.38, 0.28',
        swapinfo: '5.20% (400.00 MiB sur 7.61 GiB)',
        meminfo: '4.20 GiB sur 7.61 GiB',
        diskinfo: '63.50 GiB sur 97.87 GiB',
        vms: [
          { id: 104, name: 'backup-server', status: 'running' },
          { id: 105, name: 'monitoring', status: 'running' }
        ],
        lxc: [
          { id: 203, name: 'postgres', status: 'running' },
          { id: 204, name: 'mongodb', status: 'running' }
        ]
      },
      {
        id: 'pve-03',
        name: 'pve-03',
        status: 'offline',
        cpu_usage: 0,
        memory_usage: 0,
        disk_usage: 0,
        uptime: 0,
        temperature: 0,
        vms_count: 0,
        lxc_count: 0,
        last_update: new Date(Date.now() - 3600000).toISOString(), // Il y a 1h
        version: '8.1.3',
        ip_address: '192.168.1.12',
        cpuinfo: '4 x Intel(R) Core(TM) i3-8100 CPU @ 3.60GHz',
        kversion: 'Linux 6.14.10-1-pve',
        loadavg: '0.00, 0.00, 0.00',
        swapinfo: '0% (0 MiB sur 7.61 GiB)',
        meminfo: '0 GiB sur 7.61 GiB',
        diskinfo: '0 GiB sur 97.87 GiB',
        vms: [],
        lxc: []
      }
    ];

    localStorage.setItem('proxmoxNodes', JSON.stringify(mockNodes));
    console.log('✅ Nœuds Proxmox seedés:', mockNodes.length);
  }

  // Seed des VMs
  if (!existingVMs) {
    const mockVMs = [
      {
        id: 101,
        name: 'web-server-01',
        status: 'running',
        node: 'pve-01',
        cpu_usage: 25,
        memory_usage: 45,
        uptime: 604800, // 7 jours
        last_update: new Date().toISOString()
      },
      {
        id: 102,
        name: 'db-server-01',
        status: 'running',
        node: 'pve-01',
        cpu_usage: 60,
        memory_usage: 85,
        uptime: 1209600, // 14 jours
        last_update: new Date().toISOString()
      },
      {
        id: 103,
        name: 'app-server-01',
        status: 'stopped',
        node: 'pve-01',
        cpu_usage: 0,
        memory_usage: 0,
        uptime: 0,
        last_update: new Date(Date.now() - 86400000).toISOString() // Il y a 1 jour
      },
      {
        id: 104,
        name: 'backup-server',
        status: 'running',
        node: 'pve-02',
        cpu_usage: 15,
        memory_usage: 30,
        uptime: 2592000, // 30 jours
        last_update: new Date().toISOString()
      },
      {
        id: 105,
        name: 'monitoring',
        status: 'running',
        node: 'pve-02',
        cpu_usage: 10,
        memory_usage: 20,
        uptime: 2592000,
        last_update: new Date().toISOString()
      }
    ];

    localStorage.setItem('proxmoxVMs', JSON.stringify(mockVMs));
    console.log('✅ VMs seedées:', mockVMs.length);
  }

  // Seed des conteneurs LXC
  if (!existingLXC) {
    const mockLXC = [
      {
        id: 201,
        name: 'nginx-proxy',
        status: 'running',
        node: 'pve-01',
        cpu_usage: 5,
        memory_usage: 15,
        uptime: 2592000,
        last_update: new Date().toISOString()
      },
      {
        id: 202,
        name: 'redis-cache',
        status: 'running',
        node: 'pve-01',
        cpu_usage: 8,
        memory_usage: 25,
        uptime: 2592000,
        last_update: new Date().toISOString()
      },
      {
        id: 203,
        name: 'postgres',
        status: 'running',
        node: 'pve-02',
        cpu_usage: 12,
        memory_usage: 40,
        uptime: 2592000,
        last_update: new Date().toISOString()
      },
      {
        id: 204,
        name: 'mongodb',
        status: 'running',
        node: 'pve-02',
        cpu_usage: 18,
        memory_usage: 50,
        uptime: 2592000,
        last_update: new Date().toISOString()
      },
      {
        id: 205,
        name: 'elasticsearch',
        status: 'stopped',
        node: 'pve-01',
        cpu_usage: 0,
        memory_usage: 0,
        uptime: 0,
        last_update: new Date(Date.now() - 172800000).toISOString() // Il y a 2 jours
      }
    ];

    localStorage.setItem('proxmoxLXC', JSON.stringify(mockLXC));
    console.log('✅ Conteneurs LXC seedés:', mockLXC.length);
  }

  // Seed des événements
  if (!existingEvents) {
    const mockEvents = [
      {
        id: 'event-1',
        type: 'vm_started',
        title: 'VM web-server-01 démarrée',
        message: 'La VM web-server-01 a été démarrée avec succès sur pve-01',
        timestamp: new Date(Date.now() - 3600000), // Il y a 1h
        severity: 'low'
      },
      {
        id: 'event-2',
        type: 'lxc_started',
        title: 'LXC nginx-proxy démarré',
        message: 'Le conteneur LXC nginx-proxy est en cours d\'exécution',
        timestamp: new Date(Date.now() - 7200000), // Il y a 2h
        severity: 'low'
      },
      {
        id: 'event-3',
        type: 'node_offline',
        title: 'Nœud pve-03 hors ligne',
        message: 'Le nœud pve-03 est hors ligne depuis 1 heure',
        timestamp: new Date(Date.now() - 3600000),
        severity: 'critical'
      },
      {
        id: 'event-4',
        type: 'backup_completed',
        title: 'Sauvegarde terminée',
        message: 'La sauvegarde de la VM db-server-01 a été complétée avec succès',
        timestamp: new Date(Date.now() - 86400000), // Il y a 1 jour
        severity: 'low'
      }
    ];

    localStorage.setItem('proxmoxEvents', JSON.stringify(mockEvents));
    console.log('✅ Événements seedés:', mockEvents.length);
  }

  // Seed des storages
  if (!existingStorages) {
    const mockStorages = [
      {
        id: 'local-lvm',
        name: 'local-lvm',
        type: 'lvm',
        status: 'online',
        node: 'pve-01',
        total_space: 1000, // GB (sera converti en bytes par la page Storage si nécessaire)
        used_space: 650, // GB
        free_space: 350, // GB
        usage_percent: 65,
        vms_count: 8,
        lxc_count: 12,
        last_update: new Date().toISOString(),
        mount_point: '/dev/pve/data'
      },
      {
        id: 'nfs-shared',
        name: 'nfs-shared',
        type: 'nfs',
        status: 'online',
        node: 'pve-01',
        total_space: 2000, // GB
        used_space: 1200, // GB
        free_space: 800, // GB
        usage_percent: 60,
        vms_count: 15,
        lxc_count: 8,
        last_update: new Date().toISOString(),
        mount_point: '/mnt/nfs-shared',
        protocol: 'NFSv4'
      },
      {
        id: 'local',
        name: 'local',
        type: 'local',
        status: 'online',
        node: 'pve-02',
        total_space: 500, // GB
        used_space: 200, // GB
        free_space: 300, // GB
        usage_percent: 40,
        vms_count: 5,
        lxc_count: 3,
        last_update: new Date().toISOString()
      }
    ];

    localStorage.setItem('proxmoxStorages', JSON.stringify(mockStorages));
    console.log('✅ Storages seedés:', mockStorages.length);
  }

  // Déclencher l'événement de mise à jour
  window.dispatchEvent(new CustomEvent('proxmoxDataUpdated', {
    detail: {
      nodes: existingNodes ? JSON.parse(existingNodes) : JSON.parse(localStorage.getItem('proxmoxNodes') || '[]'),
      vms: existingVMs ? JSON.parse(existingVMs) : JSON.parse(localStorage.getItem('proxmoxVMs') || '[]'),
      lxc: existingLXC ? JSON.parse(existingLXC) : JSON.parse(localStorage.getItem('proxmoxLXC') || '[]'),
      storages: existingStorages ? JSON.parse(existingStorages) : JSON.parse(localStorage.getItem('proxmoxStorages') || '[]')
    }
  }));

  console.log('✅ Seeders frontend chargés avec succès!');
}

