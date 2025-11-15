import { useState, useEffect } from 'react';
import {
  Container,
  Play,
  Square,
  Settings,
  HardDrive,
  MemoryStick,
  Cpu,
  Clock,
  MoreVertical,
  Eye,
  Edit,
  RefreshCw
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/hooks/useTranslation';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Loader } from '@/components/ui/Loader';
import { apiPost } from '@/utils/api';
import { storage } from '@/utils/storage';

interface LXCContainer {
  id: number;
  name: string;
  status: 'running' | 'stopped';
  vmid: number;
  node: string;
  cpu_cores: number;
  memory: number; // MB
  disk: number; // GB
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  uptime: number;
  os: string;
  owner: string;
  created_at: string;
  tags?: string[];
}

export function LXC() {
  const { t } = useTranslation();
  const [containers, setContainers] = useState<LXCContainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showMoreMenu, setShowMoreMenu] = useState<number | null>(null);
  const { success, error, warning } = useToast();
  
  // États pour les modales de confirmation
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    message: '',
    onConfirm: () => {}
  });

  // Charger les conteneurs LXC depuis localStorage
  const loadContainers = () => {
    try {
      const savedLXC = localStorage.getItem('proxmoxLXC');
      if (savedLXC) {
        const proxmoxLXC = JSON.parse(savedLXC);
        console.log('🐳 Conteneurs LXC chargés depuis localStorage:', proxmoxLXC);

        // Convertir les données Proxmox vers le format LXCContainer
        const convertedContainers: LXCContainer[] = proxmoxLXC.map((container: any, index: number) => ({
          id: index + 1,
          name: container.name || `LXC-${container.id}`,
          status: container.status === 'running' ? 'running' : 'stopped',
          vmid: container.id,
          node: container.node || 'unknown',
          cpu_cores: 1, // Valeur par défaut
          memory: 1024, // Valeur par défaut
          disk: 20, // Valeur par défaut
          cpu_usage: container.cpu_usage || 0,
          memory_usage: container.memory_usage || 0,
          disk_usage: 0, // Non disponible dans les données Proxmox
          uptime: container.uptime || 0,
          os: 'Linux', // Valeur par défaut
          owner: 'admin', // Valeur par défaut
          created_at: container.last_update || new Date().toISOString(),
          tags: ['lxc', 'proxmox']
        }));

        setContainers(convertedContainers);
        console.log('✅ Conteneurs LXC convertis:', convertedContainers);
        setLoading(false);
      } else {
        const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';
        const proxmoxConfig = storage.getProxmoxConfig();
        
        // En production, si Proxmox n'est pas configuré, ne pas charger de données mockées
        if (isProduction && !proxmoxConfig) {
          console.log('⚠️ Production: Proxmox non configuré, pas de données mockées');
          setContainers([]);
          setLoading(false);
          return;
        }
        
        console.log('⚠️ Aucune donnée LXC trouvée dans localStorage - chargement des données mockées');
        loadMockData();
      }
    } catch (err) {
      console.error('❌ Erreur lors du chargement des conteneurs LXC:', err);
      const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';
      const proxmoxConfig = storage.getProxmoxConfig();
      
      // En production, si Proxmox n'est pas configuré, ne pas charger de données mockées
      if (isProduction && !proxmoxConfig) {
        setContainers([]);
        setLoading(false);
        return;
      }
      
      loadMockData();
    }
  };

  // Charger les données mockées (uniquement en développement)
  const loadMockData = () => {
    // Double vérification : ne jamais charger de données mockées en production
    const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';
    if (isProduction) {
      console.warn('⚠️ Production: Tentative de chargement de données mockées bloquée');
      setContainers([]);
      setLoading(false);
      return;
    }
    
    const mockContainers: LXCContainer[] = [
      {
        id: 1,
        name: 'nginx-proxy',
        status: 'running',
        vmid: 201,
        node: 'pve-01',
        cpu_cores: 1,
        memory: 512,
        disk: 10,
        cpu_usage: 15,
        memory_usage: 45,
        disk_usage: 30,
        uptime: 86400 * 30, // 30 jours
        os: 'Ubuntu 22.04 LTS',
        owner: 'admin',
        created_at: '2023-12-01T00:00:00Z',
        tags: ['production', 'proxy']
      },
      {
        id: 2,
        name: 'mysql-db',
        status: 'running',
        vmid: 202,
        node: 'pve-01',
        cpu_cores: 2,
        memory: 2048,
        disk: 50,
        cpu_usage: 35,
        memory_usage: 78,
        disk_usage: 65,
        uptime: 86400 * 25, // 25 jours
        os: 'Ubuntu 22.04 LTS',
        owner: 'admin',
        created_at: '2023-12-05T00:00:00Z',
        tags: ['production', 'database']
      },
      {
        id: 3,
        name: 'redis-cache',
        status: 'stopped',
        vmid: 203,
        node: 'pve-02',
        cpu_cores: 1,
        memory: 256,
        disk: 5,
        cpu_usage: 0,
        memory_usage: 0,
        disk_usage: 20,
        uptime: 0,
        os: 'Ubuntu 20.04 LTS',
        owner: 'developer',
        created_at: '2024-01-05T00:00:00Z',
        tags: ['development', 'cache']
      }
    ];

    setContainers(mockContainers);
    setLoading(false);
  };

  useEffect(() => {
    // Charger automatiquement les données Proxmox si la configuration existe
    const loadDataOnMount = async () => {
      await storage.ensureProxmoxDataLoaded();
      // Charger les conteneurs après avoir chargé les données
      loadContainers();
    };
    
    loadDataOnMount();
  }, []);

  // Rafraîchissement automatique toutes les 30 secondes
  useEffect(() => {
    const interval = setInterval(async () => {
      await storage.ensureProxmoxDataLoaded();
      loadContainers();
    }, 30000); // 30 secondes

    return () => clearInterval(interval);
  }, []);

  // Écouter les mises à jour des données Proxmox
  useEffect(() => {
    const handleProxmoxDataUpdated = () => {
      console.log('🔄 Mise à jour des données Proxmox détectée pour LXC');
      loadContainers();
    };

    window.addEventListener('proxmoxDataUpdated', handleProxmoxDataUpdated);
    return () => window.removeEventListener('proxmoxDataUpdated', handleProxmoxDataUpdated);
  }, []);

  // Fonction pour rafraîchir les conteneurs en récupérant les données Proxmox
  const refreshContainers = async () => {
    try {
      console.log('🔄 Rafraîchissement des données LXC Proxmox...');

      const savedConfig = localStorage.getItem('proxmoxConfig');
      if (!savedConfig) {
        console.log('⚠️ Aucune configuration Proxmox trouvée');
        error(t('common.error'), t('lxc.no_proxmox_config') || 'Aucune configuration Proxmox trouvée. Veuillez d\'abord configurer votre connexion Proxmox dans les Paramètres.');
        return;
      }

      const config = JSON.parse(savedConfig);

      // Utiliser apiPost pour utiliser la bonne URL de l'API (API_BASE_URL)
      const data = await apiPost<{
        success: boolean;
        message?: string;
        nodes?: any[];
        vms?: any[];
        lxc?: any[];
        storages?: any[];
      }>('/api/v1/proxmox/fetch-data', {
        url: config.url,
        username: config.username,
        secret: config.secret,
        node: config.node
      });

      if (data.success) {
        localStorage.setItem('proxmoxNodes', JSON.stringify(data.nodes || []));
        localStorage.setItem('proxmoxVMs', JSON.stringify(data.vms || []));
        localStorage.setItem('proxmoxLXC', JSON.stringify(data.lxc || []));
        if (data.storages) {
          localStorage.setItem('proxmoxStorages', JSON.stringify(data.storages));
        }

        window.dispatchEvent(new CustomEvent('proxmoxDataUpdated', {
          detail: { nodes: data.nodes, vms: data.vms, lxc: data.lxc, storages: data.storages }
        }));

        success(t('common.success'), t('lxc.refresh_success') || 'Conteneurs LXC rafraîchis avec succès');
      } else {
        const errorMsg = data.message || t('lxc.refresh_error') || 'Erreur lors du rafraîchissement des conteneurs LXC';
        error(t('common.error'), errorMsg);
      }
    } catch (err) {
      console.error('❌ Erreur lors du rafraîchissement des conteneurs LXC:', err);
      error(t('common.error'), t('lxc.refresh_error') || 'Erreur lors du rafraîchissement des conteneurs LXC');
    }
  };


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="h-4 w-4 text-green-500" />;
      case 'stopped':
        return <Square className="h-4 w-4 text-red-500" />;
      default:
        return <Square className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      running: 'success',
      stopped: 'error'
    } as const;

    const labels = {
      running: 'En cours',
      stopped: 'Arrêté'
    };

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const formatUptime = (seconds: number) => {
    if (seconds === 0) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);

    if (days > 0) return `${days}j ${hours}h`;
    return `${hours}h`;
  };

  const formatMemory = (mb: number) => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb} MB`;
  };

  const formatDisk = (gb: number) => {
    return `${gb} GB`;
  };

  const getUsageColor = (usage: number) => {
    if (usage >= 90) return 'text-red-600';
    if (usage >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  const filteredContainers = containers.filter(container => {
    const matchesSearch = container.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         container.os.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || container.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Actions pour les conteneurs LXC
  const handleContainerStart = async (container: LXCContainer) => {
    try {
      const savedConfig = localStorage.getItem('proxmoxConfig');
      if (!savedConfig) {
        error('Erreur', 'Configuration Proxmox manquante');
        return;
      }

      const config = JSON.parse(savedConfig);
      const base = config.url.replace(/\/$/, '');
      
      // Vérifier si c'est une URL de développement fictive
      const isDevUrl = base.includes('proxmox-dev.local') || base.includes('localhost') || base.includes('127.0.0.1');
      
      if (isDevUrl) {
        warning(
          'Configuration de développement',
          'Cette action nécessite une connexion Proxmox réelle. Veuillez configurer une connexion Proxmox réelle dans les Paramètres pour utiliser cette fonctionnalité.'
        );
        return;
      }
      
      const response = await fetch(`${config.url}/api2/json/nodes/${container.node}/lxc/${container.vmid}/status/start`, {
        method: 'POST',
        headers: {
          'Authorization': `PVEAPIToken=${config.username}=${config.secret}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
      setContainers(prevContainers =>
        prevContainers.map(c =>
          c.id === container.id
            ? { ...c, status: 'running' as const, uptime: 0 }
            : c
        )
      );
      success('Succès', `Conteneur ${container.name} démarré avec succès`);
        setTimeout(() => {
          refreshContainers();
        }, 1500);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      console.error('Erreur démarrage conteneur:', err);
      error('Erreur', `Impossible de démarrer le conteneur ${container.name}`);
    }
  };

  const handleContainerStop = (container: LXCContainer) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmer l\'arrêt',
      message: `Êtes-vous sûr de vouloir arrêter le conteneur ${container.name} ?`,
      variant: 'warning',
      onConfirm: async () => {
        try {
          const savedConfig = localStorage.getItem('proxmoxConfig');
          if (!savedConfig) {
            error('Erreur', 'Configuration Proxmox manquante');
            return;
          }

          const config = JSON.parse(savedConfig);
          const base = config.url.replace(/\/$/, '');
          
          // Vérifier si c'est une URL de développement fictive
          const isDevUrl = base.includes('proxmox-dev.local') || base.includes('localhost') || base.includes('127.0.0.1');
          
          if (isDevUrl) {
            warning(
              'Configuration de développement',
              'Cette action nécessite une connexion Proxmox réelle. Veuillez configurer une connexion Proxmox réelle dans les Paramètres pour utiliser cette fonctionnalité.'
            );
            return;
          }
          
          const response = await fetch(`${config.url}/api2/json/nodes/${container.node}/lxc/${container.vmid}/status/stop`, {
            method: 'POST',
            headers: {
              'Authorization': `PVEAPIToken=${config.username}=${config.secret}`,
              'Content-Type': 'application/json',
            }
          });

          if (response.ok) {
      setContainers(prevContainers =>
        prevContainers.map(c =>
          c.id === container.id
            ? { ...c, status: 'stopped' as const, uptime: 0, cpu_usage: 0, memory_usage: 0 }
            : c
        )
      );
      success('Succès', `Conteneur ${container.name} arrêté avec succès`);
            setTimeout(() => {
              refreshContainers();
            }, 1500);
          } else {
            throw new Error(`HTTP ${response.status}`);
          }
    } catch (err) {
          console.error('Erreur arrêt conteneur:', err);
      error('Erreur', `Impossible d'arrêter le conteneur ${container.name}`);
    }
      }
    });
  };

  const handleContainerConfig = (container: LXCContainer) => {
    try {
      const savedConfig = localStorage.getItem('proxmoxConfig');
      if (!savedConfig) {
        warning('Information', 'Configurez Proxmox dans les Paramètres avant d\'ouvrir la configuration');
        return;
      }

      const config = JSON.parse(savedConfig);
      const base = config.url.replace(/\/$/, '');
      
      // Vérifier si c'est une URL de développement fictive
      const isDevUrl = base.includes('proxmox-dev.local') || base.includes('localhost') || base.includes('127.0.0.1');
      
      if (isDevUrl) {
        warning(
          'Configuration de développement',
          'La configuration Proxmox ne peut pas être ouverte avec une configuration fictive. Veuillez configurer une connexion Proxmox réelle dans les Paramètres pour utiliser cette fonctionnalité.'
        );
        return;
      }
      
      // Ouvrir la page de configuration du conteneur dans Proxmox
      const configUrl = `${base}/?vmid=${container.vmid}&node=${encodeURIComponent(container.node)}`;
      console.log(`⚙️ Ouverture de la configuration pour ${container.name} (${container.vmid})...`);
      const configWindow = window.open(configUrl, '_blank', 'width=1200,height=800');
      
      if (configWindow) {
        success('Succès', `Configuration ouverte pour ${container.name}`);
      } else {
        warning('Attention', 'La fenêtre de configuration a été bloquée par le navigateur. Veuillez autoriser les popups pour ce site.');
      }
    } catch (err: any) {
      console.error('Erreur configuration conteneur:', err);
      const errorMessage = err.message || 'Erreur lors de l\'ouverture de la configuration';
      error('Erreur', `Impossible d'ouvrir la configuration pour ${container.name}: ${errorMessage}`);
    }
  };

  const handleContainerView = (container: LXCContainer) => {
    success('Information', `Affichage des détails du conteneur ${container.name}`);
  };

  const handleContainerEdit = (container: LXCContainer) => {
    warning('Information', `L'édition du conteneur ${container.name} sera disponible dans une prochaine version`);
  };

  const handleContainerConsole = (container: LXCContainer) => {
    try {
      const savedConfig = localStorage.getItem('proxmoxConfig');
      if (!savedConfig) {
        warning('Information', 'Configurez Proxmox dans les Paramètres avant d\'ouvrir la console');
        return;
      }

      const config = JSON.parse(savedConfig);
      const base = config.url.replace(/\/$/, '');
      
      // Vérifier si c'est une URL de développement fictive
      const isDevUrl = base.includes('proxmox-dev.local') || base.includes('localhost') || base.includes('127.0.0.1');
      
      if (isDevUrl) {
        warning(
          'Configuration de développement',
          'La console Proxmox ne peut pas être ouverte avec une configuration fictive. Veuillez configurer une connexion Proxmox réelle dans les Paramètres pour utiliser la console.'
        );
        return;
      }
      
      const consoleUrl = `${base}/?console=lxc&novnc=1&vmid=${container.vmid}&node=${container.node}`;
      console.log(`🖥️ Ouverture de la console pour ${container.name} (${container.vmid})...`);
      const consoleWindow = window.open(consoleUrl, '_blank', 'width=800,height=600');
      
      if (consoleWindow) {
        success('Succès', `Console ouverte pour ${container.name}`);
      } else {
        warning('Attention', 'La fenêtre de console a été bloquée par le navigateur. Veuillez autoriser les popups pour ce site.');
      }
    } catch (err) {
      console.error('Erreur console conteneur:', err);
      error('Erreur', `Impossible d'ouvrir la console pour ${container.name}`);
    }
  };

  const handleContainerMore = (container: LXCContainer) => {
    // Toggle le menu pour ce conteneur
    setShowMoreMenu(showMoreMenu === container.id ? null : container.id);
  };

  const handleContainerAction = (container: LXCContainer, action: string) => {
    setShowMoreMenu(null);
    switch (action) {
      case 'console':
        handleContainerConsole(container);
        break;
      case 'snapshot':
        warning('Information', `La création de snapshots sera disponible dans une prochaine version`);
        break;
      case 'migrate':
        warning('Information', `La migration de conteneurs sera disponible dans une prochaine version`);
        break;
      case 'clone':
        warning('Information', `Le clonage de conteneurs sera disponible dans une prochaine version`);
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader size="lg" variant="spinner" text="Chargement des conteneurs LXC..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {t('lxc.title')}
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
            {t('lxc.description')}
        </p>
        </div>
        <Button onClick={refreshContainers}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Container className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Total
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {containers.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Play className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                En cours
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {containers.filter(c => c.status === 'running').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Square className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Arrêtés
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {containers.filter(c => c.status === 'stopped').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-64">
          <Input
            placeholder="Rechercher un conteneur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: 'all', label: 'Tous les statuts' },
            { value: 'running', label: 'En cours' },
            { value: 'stopped', label: 'Arrêtés' }
          ]}
        />
      </div>

      {/* Liste des conteneurs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredContainers.map((container) => (
          <Card key={container.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(container.status)}
                  <div>
                    <CardTitle className="text-lg">{container.name}</CardTitle>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      CT ID: {container.vmid} • {container.node}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(container.status)}
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1"
                      onClick={() => handleContainerView(container)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1"
                      onClick={() => handleContainerEdit(container)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <div className="relative">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="p-1"
                      onClick={() => handleContainerMore(container)}
                      title="Plus d'actions"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                      {showMoreMenu === container.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setShowMoreMenu(null)}
                          />
                          <div className="absolute right-0 top-8 z-20 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1">
                            <button
                              onClick={() => handleContainerAction(container, 'console')}
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              Console
                            </button>
                            <button
                              onClick={() => handleContainerAction(container, 'snapshot')}
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              Snapshot
                            </button>
                            <button
                              onClick={() => handleContainerAction(container, 'migrate')}
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              Migrer
                            </button>
                            <button
                              onClick={() => handleContainerAction(container, 'clone')}
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              Cloner
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Informations système */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <Cpu className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">CPU:</span>
                  <span>{container.cpu_cores} cœurs</span>
                </div>
                <div className="flex items-center space-x-2">
                  <MemoryStick className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">RAM:</span>
                  <span>{formatMemory(container.memory)}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <HardDrive className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">Disque:</span>
                  <span>{formatDisk(container.disk)}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">Uptime:</span>
                  <span>{formatUptime(container.uptime)}</span>
                </div>
              </div>

              {/* Utilisation des ressources (seulement si en cours) */}
              {container.status === 'running' && (
                <div className="space-y-3">
                  {/* CPU */}
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center space-x-2">
                        <Cpu className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                        <span className="text-slate-600 dark:text-slate-400">CPU</span>
                      </div>
                      <span className={`font-medium ${getUsageColor(container.cpu_usage)}`}>
                        {container.cpu_usage}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${container.cpu_usage}%` }}
                      />
                    </div>
                  </div>

                  {/* Mémoire */}
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center space-x-2">
                        <MemoryStick className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                        <span className="text-slate-600 dark:text-slate-400">Mémoire</span>
                      </div>
                      <span className={`font-medium ${getUsageColor(container.memory_usage)}`}>
                        {container.memory_usage}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${container.memory_usage}%` }}
                      />
                    </div>
                  </div>

                  {/* Disque */}
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center space-x-2">
                        <HardDrive className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                        <span className="text-slate-600 dark:text-slate-400">Disque</span>
                      </div>
                      <span className={`font-medium ${getUsageColor(container.disk_usage)}`}>
                        {container.disk_usage}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                      <div
                        className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${container.disk_usage}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tags */}
              {container.tags && container.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {container.tags.map((tag, index) => (
                    <Badge key={index} variant="default" size="sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                {container.status === 'running' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleContainerStop(container)}
                  >
                    <Square className="h-4 w-4 mr-1" />
                    Arrêter
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleContainerStart(container)}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Démarrer
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleContainerConfig(container)}
                >
                  <Settings className="h-4 w-4 mr-1" />
                  Config
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredContainers.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Container className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              Aucun conteneur trouvé
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Aucun conteneur LXC ne correspond aux critères de recherche.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Modale de confirmation */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant || 'warning'}
        confirmText="Confirmer"
        cancelText="Annuler"
      />
    </div>
  );
}
