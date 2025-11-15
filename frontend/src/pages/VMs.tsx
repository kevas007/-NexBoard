import { useState, useEffect } from 'react';
import {
  Monitor,
  Play,
  Pause,
  Square,
  RotateCcw,
  Settings,
  HardDrive,
  MemoryStick,
  Cpu,
  Clock,
  MoreVertical,
  Eye,
  Edit
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
import { ProxmoxConfigRequired } from '@/components/ProxmoxConfigRequired';
import { storage } from '@/utils/storage';

interface VM {
  id: number;
  name: string;
  status: 'running' | 'stopped' | 'paused' | 'suspended';
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
  last_backup?: string;
  tags?: string[];
}

export function VMs() {
  const { t } = useTranslation();
  const [vms, setVMs] = useState<VM[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [nodeFilter, setNodeFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
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

  // Charger les VMs depuis localStorage
  const loadVMs = () => {
    try {
      const savedVMs = localStorage.getItem('proxmoxVMs');
      if (savedVMs) {
        const proxmoxVMs = JSON.parse(savedVMs);
        console.log('📊 VMs chargées depuis localStorage:', proxmoxVMs);

        // Convertir les données Proxmox vers le format VM
        const convertedVMs: VM[] = proxmoxVMs.map((vm: any, index: number) => {
          // Extraire les vraies données depuis Proxmox
          const maxcpu = vm.maxcpu || 2; // Nombre de cœurs CPU
          const maxmem = vm.maxmem || 2048 * 1024 * 1024; // Mémoire en bytes
          const memoryMB = Math.round(maxmem / (1024 * 1024)); // Convertir en MB
          const diskGB = vm.disk ? Math.round(vm.disk / (1024 * 1024 * 1024)) : 50; // Disque en GB
          
          // Extraire les tags si disponibles
          const tags = vm.tags ? vm.tags.split(',') : ['proxmox'];
          
          return {
          id: index + 1,
          name: vm.name || `VM-${vm.id}`,
            status: vm.status === 'running' ? 'running' : vm.status === 'stopped' ? 'stopped' : vm.status === 'paused' ? 'paused' : 'stopped',
            vmid: vm.id || vm.vmid,
          node: vm.node || 'unknown',
            cpu_cores: maxcpu,
            memory: memoryMB,
            disk: diskGB,
          cpu_usage: vm.cpu_usage || 0,
          memory_usage: vm.memory_usage || 0,
            disk_usage: vm.disk_usage || 0,
          uptime: vm.uptime || 0,
            os: vm.ostype || 'Linux',
            owner: vm.owner || 'admin',
          created_at: vm.last_update || new Date().toISOString(),
            tags: tags
          };
        });

        setVMs(convertedVMs);
        console.log('✅ VMs converties:', convertedVMs);
        setLoading(false);
      } else {
        const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';
        const proxmoxConfig = storage.getProxmoxConfig();
        
        // En production, si Proxmox n'est pas configuré, ne pas charger de données mockées
        if (isProduction && !proxmoxConfig) {
          console.log('⚠️ Production: Proxmox non configuré, pas de données mockées');
          setVMs([]);
          setLoading(false);
          return;
        }
        
        console.log('⚠️ Aucune donnée VMs trouvée dans localStorage - chargement des données mockées');
        loadMockData();
      }
    } catch (err) {
      console.error('❌ Erreur lors du chargement des VMs:', err);
      const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';
      const proxmoxConfig = storage.getProxmoxConfig();
      
      // En production, si Proxmox n'est pas configuré, ne pas charger de données mockées
      if (isProduction && !proxmoxConfig) {
        setVMs([]);
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
      setVMs([]);
      setLoading(false);
      return;
    }
    
    const mockVMs: VM[] = [
      {
        id: 1,
        name: 'web-server-01',
        status: 'running',
        vmid: 101,
        node: 'pve-01',
        cpu_cores: 2,
        memory: 4096,
        disk: 50,
        cpu_usage: 25,
        memory_usage: 68,
        disk_usage: 45,
        uptime: 86400 * 7, // 7 jours
        os: 'Ubuntu 22.04 LTS',
        owner: 'admin',
        created_at: '2024-01-01T00:00:00Z',
        last_backup: '2024-01-14T02:00:00Z',
        tags: ['production', 'web']
      },
      {
        id: 2,
        name: 'db-server-01',
        status: 'running',
        vmid: 102,
        node: 'pve-01',
        cpu_cores: 4,
        memory: 8192,
        disk: 100,
        cpu_usage: 45,
        memory_usage: 78,
        disk_usage: 62,
        uptime: 86400 * 15, // 15 jours
        os: 'Ubuntu 22.04 LTS',
        owner: 'admin',
        created_at: '2023-12-15T00:00:00Z',
        last_backup: '2024-01-14T02:30:00Z',
        tags: ['production', 'database']
      }
    ];

    setVMs(mockVMs);
    setLoading(false);
  };

  useEffect(() => {
    // Charger automatiquement les données Proxmox si la configuration existe
    const loadDataOnMount = async () => {
      await storage.ensureProxmoxDataLoaded();
      // Charger les VMs après avoir chargé les données
      loadVMs();
    };
    
    loadDataOnMount();
  }, []);

  // Rafraîchissement automatique toutes les 30 secondes
  useEffect(() => {
    const interval = setInterval(async () => {
      await storage.ensureProxmoxDataLoaded();
      loadVMs();
    }, 30000); // 30 secondes

    return () => clearInterval(interval);
  }, []);

  // Écouter les mises à jour des données Proxmox
  useEffect(() => {
    const handleProxmoxDataUpdate = () => {
      console.log('🔄 Mise à jour des données Proxmox détectée pour VMs');
      loadVMs();
    };

    window.addEventListener('proxmoxDataUpdated', handleProxmoxDataUpdate);
    return () => window.removeEventListener('proxmoxDataUpdated', handleProxmoxDataUpdate);
  }, []);

  // Fonction pour rafraîchir les VMs en récupérant les données Proxmox
  const refreshVMs = async () => {
    try {
      console.log('🔄 Rafraîchissement des données VMs Proxmox...');

      const savedConfig = localStorage.getItem('proxmoxConfig');
      if (!savedConfig) {
        console.log('⚠️ Aucune configuration Proxmox trouvée');
        error(t('common.error'), 'Aucune configuration Proxmox trouvée. Veuillez d\'abord configurer votre connexion Proxmox dans les Paramètres.');
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
        networks?: any[];
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
        if (data.networks) {
          localStorage.setItem('proxmoxNetworks', JSON.stringify(data.networks));
        }

        window.dispatchEvent(new CustomEvent('proxmoxDataUpdated', {
          detail: { nodes: data.nodes, vms: data.vms, lxc: data.lxc, storages: data.storages, networks: data.networks }
        }));

        success(t('common.success'), 'VMs rafraîchies avec succès');
      } else {
        const errorMsg = data.message || 'Erreur lors du rafraîchissement des VMs';
        error(t('common.error'), errorMsg);
      }
    } catch (err) {
      console.error('❌ Erreur lors du rafraîchissement des VMs:', err);
      error(t('common.error'), 'Erreur lors du rafraîchissement des VMs');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="h-4 w-4 text-green-500" />;
      case 'stopped':
        return <Square className="h-4 w-4 text-red-500" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      case 'suspended':
        return <RotateCcw className="h-4 w-4 text-gray-500" />;
      default:
        return <Square className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      running: 'success',
      stopped: 'error',
      paused: 'warning',
      suspended: 'default'
    } as const;

    const labels = {
      running: 'En cours',
      stopped: 'Arrêtée',
      paused: 'En pause',
      suspended: 'Suspendue'
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  // Extraire tous les tags uniques
  const allTags = Array.from(new Set(vms.flatMap((vm: VM) => vm.tags || []))).sort();

  const filteredVMs = vms.filter(vm => {
    const matchesSearch = vm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vm.os.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || vm.status === statusFilter;
    const matchesNode = nodeFilter === 'all' || vm.node === nodeFilter;
    const matchesTag = tagFilter === 'all' || (vm.tags && vm.tags.includes(tagFilter));
    return matchesSearch && matchesStatus && matchesNode && matchesTag;
  });

  // Actions pour les VMs
  const handleVMStart = async (vm: VM) => {
    try {
      const savedConfig = localStorage.getItem('proxmoxConfig');
      if (!savedConfig) {
        error('Erreur', 'Configuration Proxmox manquante. Veuillez configurer Proxmox dans les Paramètres.');
        return;
      }

      const config = JSON.parse(savedConfig);
      
      console.log(`🚀 Démarrage de la VM ${vm.name} (${vm.vmid}) sur ${vm.node}...`);
      
      const response = await apiPost<{ success: boolean; message?: string; error?: string }>(
        '/api/v1/proxmox/vm/start',
        {
          url: config.url,
          username: config.username,
          secret: config.secret,
          node: vm.node,
          vmid: vm.vmid
        }
      );

      if (response.success) {
        setVMs(prevVMs =>
          prevVMs.map(v =>
            v.id === vm.id
              ? { ...v, status: 'running' as const, uptime: 0 }
              : v
          )
        );
        success('Succès', `VM ${vm.name} en cours de démarrage`);
        // Rafraîchir les données après 2 secondes
        setTimeout(() => {
          refreshVMs();
        }, 2000);
      } else {
        throw new Error(response.error || 'Erreur inconnue');
      }
    } catch (err: any) {
      console.error('Erreur démarrage VM:', err);
      const errorMessage = err.message || 'Erreur de connexion à Proxmox';
      error('Erreur', `Impossible de démarrer la VM ${vm.name}: ${errorMessage}`);
    }
  };

  const handleVMStop = (vm: VM) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmer l\'arrêt',
      message: `Êtes-vous sûr de vouloir arrêter la VM ${vm.name} ?`,
      variant: 'warning',
      onConfirm: async () => {
    try {
          const savedConfig = localStorage.getItem('proxmoxConfig');
          if (!savedConfig) {
            error('Erreur', 'Configuration Proxmox manquante. Veuillez configurer Proxmox dans les Paramètres.');
            return;
          }

          const config = JSON.parse(savedConfig);
          
          console.log(`🛑 Arrêt de la VM ${vm.name} (${vm.vmid}) sur ${vm.node}...`);
          
          const response = await apiPost<{ success: boolean; message?: string; error?: string }>(
            '/api/v1/proxmox/vm/stop',
            {
              url: config.url,
              username: config.username,
              secret: config.secret,
              node: vm.node,
              vmid: vm.vmid
            }
          );

          if (response.success) {
            setVMs(prevVMs =>
              prevVMs.map(v =>
                v.id === vm.id
                  ? { ...v, status: 'stopped' as const, uptime: 0, cpu_usage: 0, memory_usage: 0 }
                  : v
              )
            );
            success('Succès', `VM ${vm.name} en cours d'arrêt`);
            setTimeout(() => {
              refreshVMs();
            }, 2000);
          } else {
            throw new Error(response.error || 'Erreur inconnue');
          }
        } catch (err: any) {
          console.error('Erreur arrêt VM:', err);
          const errorMessage = err.message || 'Erreur de connexion à Proxmox';
          error('Erreur', `Impossible d'arrêter la VM ${vm.name}: ${errorMessage}`);
    }
      }
    });
  };

  const handleVMPause = async (vm: VM) => {
    try {
      const savedConfig = localStorage.getItem('proxmoxConfig');
      if (!savedConfig) {
        error('Erreur', 'Configuration Proxmox manquante. Veuillez configurer Proxmox dans les Paramètres.');
        return;
      }

      const config = JSON.parse(savedConfig);
      
      console.log(`⏸️ Mise en pause de la VM ${vm.name} (${vm.vmid}) sur ${vm.node}...`);
      
      const response = await apiPost<{ success: boolean; message?: string; error?: string }>(
        '/api/v1/proxmox/vm/pause',
        {
          url: config.url,
          username: config.username,
          secret: config.secret,
          node: vm.node,
          vmid: vm.vmid
        }
      );

      if (response.success) {
        setVMs(prevVMs =>
          prevVMs.map(v =>
            v.id === vm.id
              ? { ...v, status: 'paused' as const }
              : v
          )
        );
        success('Succès', `VM ${vm.name} mise en pause`);
        setTimeout(() => {
          refreshVMs();
        }, 2000);
      } else {
        throw new Error(response.error || 'Erreur inconnue');
      }
    } catch (err: any) {
      console.error('Erreur pause VM:', err);
      const errorMessage = err.message || 'Erreur de connexion à Proxmox';
      error('Erreur', `Impossible de mettre en pause la VM ${vm.name}: ${errorMessage}`);
    }
  };

  const handleVMRestart = (vm: VM) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmer le redémarrage',
      message: `Êtes-vous sûr de vouloir redémarrer la VM ${vm.name} ?\n\nLa VM sera temporairement indisponible.`,
      variant: 'warning',
      onConfirm: async () => {
    try {
          const savedConfig = localStorage.getItem('proxmoxConfig');
          if (!savedConfig) {
            error('Erreur', 'Configuration Proxmox manquante. Veuillez configurer Proxmox dans les Paramètres.');
            return;
          }

          const config = JSON.parse(savedConfig);
          
          console.log(`🔄 Redémarrage de la VM ${vm.name} (${vm.vmid}) sur ${vm.node}...`);
          
          const response = await apiPost<{ success: boolean; message?: string; error?: string }>(
            '/api/v1/proxmox/vm/restart',
            {
              url: config.url,
              username: config.username,
              secret: config.secret,
              node: vm.node,
              vmid: vm.vmid
            }
          );

          if (response.success) {
            setVMs(prevVMs =>
              prevVMs.map(v =>
                v.id === vm.id
                  ? { ...v, status: 'running' as const, uptime: 0 }
                  : v
              )
            );
            success('Succès', `VM ${vm.name} en cours de redémarrage`);
            setTimeout(() => {
              refreshVMs();
            }, 3000);
          } else {
            throw new Error(response.error || 'Erreur inconnue');
          }
        } catch (err: any) {
          console.error('Erreur redémarrage VM:', err);
          const errorMessage = err.message || 'Erreur de connexion à Proxmox';
          error('Erreur', `Impossible de redémarrer la VM ${vm.name}: ${errorMessage}`);
    }
      }
    });
  };

  const handleVMConfig = async (vm: VM) => {
    try {
      const savedConfig = localStorage.getItem('proxmoxConfig');
      if (!savedConfig) {
        warning('Information', 'Configurez Proxmox dans les Paramètres avant d\'ouvrir la configuration');
        return;
      }

      const config = JSON.parse(savedConfig);
      

      console.log(`⚙️ Ouverture de la configuration pour ${vm.name} (${vm.vmid})...`);
      console.log(`🔍 Config envoyée: username=${config.username}, secret=${config.secret ? '***' : 'manquant'}, password=${config.password ? '***' : 'non fourni'}`);
      
      // Obtenir l'URL de la configuration avec authentification depuis le backend
      // Si un password est fourni, l'utiliser pour obtenir le ticket (utile avec les tokens API)
      const response = await apiPost<{ success: boolean; configUrl?: string; error?: string }>(
        '/api/v1/proxmox/vm/config',
        {
          url: config.url,
          username: config.username,
          secret: config.secret,
          password: config.password || undefined, // Envoyer le password si disponible
          node: vm.node,
          vmid: vm.vmid
        }
      );

      if (response.success && response.configUrl) {
        console.log('URL configuration:', response.configUrl);
        const configWindow = window.open(response.configUrl, '_blank', 'width=1200,height=800');
        
        if (configWindow) {
          success('Succès', `Configuration ouverte pour ${vm.name}`);
        } else {
          warning('Attention', 'La fenêtre de configuration a été bloquée par le navigateur. Veuillez autoriser les popups pour ce site.');
        }
      } else {
        throw new Error(response.error || 'Erreur lors de la génération de l\'URL de la configuration');
      }
    } catch (err: any) {
      console.error('Erreur configuration VM:', err);
      const errorMessage = err.message || 'Erreur lors de l\'ouverture de la configuration';
      error('Erreur', `Impossible d'ouvrir la configuration pour ${vm.name}: ${errorMessage}`);
    }
  };

  const handleVMView = (vm: VM) => {
    success('Information', `Affichage des détails de la VM ${vm.name}`);
  };

  const handleVMEdit = (vm: VM) => {
    warning('Information', `L'édition de la VM ${vm.name} sera disponible dans une prochaine version`);
  };

  const handleVMConsole = async (vm: VM) => {
    try {
      const savedConfig = localStorage.getItem('proxmoxConfig');
      if (!savedConfig) {
        warning('Information', 'Configurez Proxmox dans les Paramètres avant d\'ouvrir la console');
        return;
      }

      const config = JSON.parse(savedConfig);
      
      console.log(`🖥️ Ouverture de la console pour ${vm.name} (${vm.vmid})...`);
      console.log(`🔍 Config envoyée: username=${config.username}, secret=${config.secret ? '***' : 'manquant'}, password=${config.password ? '***' : 'non fourni'}`);
      
      // Obtenir l'URL de la console avec authentification depuis le backend
      // Si un password est fourni, l'utiliser pour obtenir le ticket (utile avec les tokens API)
      const response = await apiPost<{ success: boolean; consoleUrl?: string; error?: string }>(
        '/api/v1/proxmox/vm/console',
        {
          url: config.url,
          username: config.username,
          secret: config.secret,
          password: config.password || undefined, // Envoyer le password si disponible
          node: vm.node,
          vmid: vm.vmid
        }
      );

      if (response.success && response.consoleUrl) {
        console.log('URL console:', response.consoleUrl);
        const consoleWindow = window.open(response.consoleUrl, '_blank', 'width=1200,height=800');
        
        if (consoleWindow) {
          success('Succès', `Console ouverte pour ${vm.name}`);
        } else {
          warning('Attention', 'La fenêtre de console a été bloquée par le navigateur. Veuillez autoriser les popups pour ce site.');
        }
      } else {
        throw new Error(response.error || 'Erreur lors de la génération de l\'URL de la console');
      }
    } catch (err: any) {
      console.error('Erreur console VM:', err);
      const errorMessage = err.message || 'Erreur lors de l\'ouverture de la console';
      error('Erreur', `Impossible d'ouvrir la console pour ${vm.name}: ${errorMessage}`);
    }
  };

  const handleVMMore = (vm: VM) => {
    // Toggle le menu pour cette VM
    setShowMoreMenu(showMoreMenu === vm.id ? null : vm.id);
  };

  const handleVMAction = (vm: VM, action: string) => {
    setShowMoreMenu(null);
    switch (action) {
      case 'console':
        handleVMConsole(vm);
        break;
      case 'snapshot':
        warning('Information', `La création de snapshots sera disponible dans une prochaine version`);
        break;
      case 'migrate':
        warning('Information', `La migration de VMs sera disponible dans une prochaine version`);
        break;
      case 'clone':
        warning('Information', `Le clonage de VMs sera disponible dans une prochaine version`);
        break;
      default:
        break;
    }
  };

  const uniqueNodes = [...new Set(vms.map(vm => vm.node))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader size="lg" variant="spinner" text="Chargement des VMs..." />
      </div>
    );
  }

  // Vérifier si Proxmox est configuré
  const proxmoxConfig = storage.getProxmoxConfig();
  const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';

  // En production, si Proxmox n'est pas configuré, ne rien afficher
  if (isProduction && !proxmoxConfig) {
    return null;
  }

  return (
    <div className="space-y-6">
      <ProxmoxConfigRequired />
      <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {t('vms.title') || 'Machines virtuelles'}
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
            {t('vms.description') || 'Gestion et monitoring des VMs'}
        </p>
        </div>
        <Button onClick={refreshVMs} variant="outline" size="sm">
          <RotateCcw className="h-4 w-4 mr-2" />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Monitor className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Total
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {vms.length}
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
              {vms.filter(vm => vm.status === 'running').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Square className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Arrêtées
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {vms.filter(vm => vm.status === 'stopped').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Pause className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Autres
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {vms.filter(vm => vm.status !== 'running' && vm.status !== 'stopped').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-64">
          <Input
            placeholder="Rechercher une VM..."
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
            { value: 'stopped', label: 'Arrêtées' },
            { value: 'paused', label: 'En pause' },
            { value: 'suspended', label: 'Suspendues' }
          ]}
        />
        <Select
          value={nodeFilter}
          onChange={(e) => setNodeFilter(e.target.value)}
          options={[
            { value: 'all', label: 'Tous les nœuds' },
            ...uniqueNodes.map(node => ({ value: node, label: node }))
          ]}
        />
        {allTags.length > 0 && (
          <Select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            options={[
              { value: 'all', label: 'Tous les tags' },
              ...allTags.map(tag => ({ value: tag, label: tag }))
            ]}
          />
        )}
      </div>

      {/* Liste des VMs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredVMs.map((vm) => (
          <Card key={vm.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(vm.status)}
                  <div>
                    <CardTitle className="text-lg">{vm.name}</CardTitle>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      VM ID: {vm.vmid} • {vm.node}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(vm.status)}
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1"
                      onClick={() => handleVMView(vm)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1"
                      onClick={() => handleVMEdit(vm)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <div className="relative">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="p-1"
                      onClick={() => handleVMMore(vm)}
                      title="Plus d'actions"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                      {showMoreMenu === vm.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setShowMoreMenu(null)}
                          />
                          <div className="absolute right-0 top-8 z-20 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1">
                            <button
                              onClick={() => handleVMAction(vm, 'console')}
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              Console VNC
                            </button>
                            <button
                              onClick={() => handleVMAction(vm, 'snapshot')}
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              Snapshot
                            </button>
                            <button
                              onClick={() => handleVMAction(vm, 'migrate')}
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              Migrer
                            </button>
                            <button
                              onClick={() => handleVMAction(vm, 'clone')}
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

            <CardContent className="space-y-4 overflow-hidden max-w-full">
              {/* Informations système */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <Cpu className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">CPU:</span>
                  <span className="font-medium">{vm.cpu_cores} cœurs</span>
                </div>
                <div className="flex items-center space-x-2">
                  <HardDrive className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">Disque:</span>
                  <span className="font-medium">{formatDisk(vm.disk)}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <MemoryStick className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">RAM:</span>
                  <span className="font-medium">{formatMemory(vm.memory)}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">Uptime:</span>
                  <span className="font-medium">{formatUptime(vm.uptime)}</span>
                </div>
              </div>

              {/* Utilisation des ressources (toujours affichée) */}
                <div className="space-y-3">
                  {/* CPU */}
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center space-x-2">
                        <Cpu className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                        <span className="text-slate-600 dark:text-slate-400">CPU</span>
                      </div>
                      <span className={`font-medium ${getUsageColor(vm.cpu_usage)}`}>
                        {vm.cpu_usage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${vm.cpu_usage}%` }}
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
                      <span className={`font-medium ${getUsageColor(vm.memory_usage)}`}>
                        {vm.memory_usage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${vm.memory_usage}%` }}
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
                      <span className={`font-medium ${getUsageColor(vm.disk_usage)}`}>
                        {vm.disk_usage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                      <div
                        className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${vm.disk_usage}%` }}
                      />
                    </div>
                  </div>
                </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 items-center">
                {vm.tags && vm.tags.length > 0 ? (
                  vm.tags.map((tag: string, index: number) => (
                    <Badge 
                      key={index} 
                      variant="default" 
                      size="sm"
                      className="cursor-pointer hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors"
                      onClick={() => setTagFilter(tag)}
                    >
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500">Aucun tag</span>
              )}
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700 -mx-6 px-6">
                <div className="flex flex-wrap gap-2 w-full">
                {vm.status === 'running' ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                        className="flex-1 min-w-[80px] text-xs px-2 py-2 flex items-center justify-center"
                      onClick={() => handleVMPause(vm)}
                    >
                        <Pause className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                        <span>Pause</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                        className="flex-1 min-w-[80px] text-xs px-2 py-2 flex items-center justify-center"
                      onClick={() => handleVMStop(vm)}
                    >
                        <Square className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                        <span>Arrêter</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                        className="flex-1 min-w-[100px] text-xs px-2 py-2 flex items-center justify-center"
                      onClick={() => handleVMRestart(vm)}
                        title="Redémarrer"
                    >
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                        <span className="whitespace-nowrap">Redémarrer</span>
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                      className="flex-1 min-w-[80px] text-xs px-2 py-2 flex items-center justify-center"
                    onClick={() => handleVMStart(vm)}
                  >
                      <Play className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                      <span>Démarrer</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                    className="flex-1 min-w-[80px] text-xs px-2 py-2 flex items-center justify-center"
                    onClick={() => handleVMConsole(vm)}
                  >
                    <Monitor className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                    <span>Console</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 min-w-[80px] text-xs px-2 py-2 flex items-center justify-center"
                  onClick={() => handleVMConfig(vm)}
                >
                    <Settings className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                    <span>Config</span>
                </Button>
                </div>
              </div>

              {/* Dernière sauvegarde */}
              {vm.last_backup && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Dernière sauvegarde: {formatDate(vm.last_backup)}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredVMs.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Monitor className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              Aucune VM trouvée
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Aucune machine virtuelle ne correspond aux critères de recherche.
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
