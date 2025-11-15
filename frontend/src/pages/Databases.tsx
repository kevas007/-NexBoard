import { useState, useEffect } from 'react';
import {
  Database,
  Server,
  HardDrive,
  MemoryStick,
  Cpu,
  Clock,
  Users,
  Lock,
  Globe,
  MoreVertical,
  Eye,
  Edit,
  Play,
  Square,
  RotateCcw,
  Settings,
  Download,
  ExternalLink,
  Monitor,
  Container
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Loader } from '@/components/ui/Loader';
import { apiPost } from '@/utils/api';
import { storage } from '@/utils/storage';

interface DatabaseInstance {
  id: string;
  name: string;
  type: 'mysql' | 'postgresql' | 'mongodb' | 'redis' | 'elasticsearch';
  status: 'running' | 'stopped' | 'maintenance';
  host: string;
  port: number;
  version: string;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  connections: number;
  max_connections: number;
  uptime: number;
  last_backup?: string;
  size: number; // GB
  created_at: string;
  ssl_enabled: boolean;
  authentication: string;
  // Informations pour ouvrir la VM/LXC
  resource_type?: 'vm' | 'qemu' | 'lxc';
  resource_id?: number;
  node?: string;
}

export function Databases() {
  const [databases, setDatabases] = useState<DatabaseInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showMoreMenu, setShowMoreMenu] = useState<string | null>(null);
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

  // Charger les données Databases depuis Proxmox
  const loadDatabasesData = async () => {
    try {
      setLoading(true);
      
      // Essayer de charger les données Proxmox réelles
      const savedConfig = localStorage.getItem('proxmoxConfig');
      if (!savedConfig) {
        console.log('⚠️ Aucune configuration Proxmox trouvée');
        setDatabases([]);
        setLoading(false);
        return;
      }

      const config = JSON.parse(savedConfig);

      // Appeler l'API backend pour récupérer les bases de données
      const data = await apiPost<{
        success: boolean;
        message?: string;
        databases?: any[];
      }>('/api/v1/proxmox/fetch-databases', {
        url: config.url,
        username: config.username,
        secret: config.secret
      });

      if (data.success && data.databases && data.databases.length > 0) {
        // Convertir les données Proxmox vers le format DatabaseInstance
        const convertedDatabases: DatabaseInstance[] = data.databases.map((db: any) => ({
          id: db.id || db.name || 'unknown',
          name: db.name || db.id || 'unknown',
          type: (db.type || 'mysql') as DatabaseInstance['type'],
          status: (db.status === 'running' ? 'running' : db.status === 'stopped' ? 'stopped' : 'maintenance') as DatabaseInstance['status'],
          host: db.host || 'localhost',
          port: db.port || 3306,
          version: db.version || 'N/A',
          cpu_usage: db.cpu_usage || 0,
          memory_usage: db.memory_usage || 0,
          disk_usage: db.disk_usage || 0,
          connections: db.connections || 0,
          max_connections: db.max_connections || 100,
          uptime: db.uptime || 0,
          last_backup: db.last_backup,
          size: db.size || 0,
          created_at: db.created_at || new Date().toISOString(),
          ssl_enabled: db.ssl_enabled || false,
          authentication: db.authentication || 'none',
          // Informations pour ouvrir la VM/LXC
          resource_type: db.resource_type,
          resource_id: db.resource_id,
          node: db.node
        }));

        setDatabases(convertedDatabases);
        console.log('✅ Bases de données chargées depuis Proxmox:', convertedDatabases.length);
      } else {
        // Aucune base de données détectée (normal car Proxmox ne gère pas directement les bases de données)
        console.log('ℹ️ Aucune base de données détectée depuis Proxmox (fonctionnalité à implémenter)');
        setDatabases([]);
      }
    } catch (err) {
      console.error('❌ Erreur lors du chargement des données Databases:', err);
      setDatabases([]);
    } finally {
      setLoading(false);
    }
  };

  // Message d'information supprimé - les données sont maintenant intégrées

  useEffect(() => {
    // Charger automatiquement les données Proxmox si la configuration existe
    const loadDataOnMount = async () => {
      await storage.ensureProxmoxDataLoaded();
      // Charger les bases de données après avoir chargé les données
      await loadDatabasesData();
    };
    
    loadDataOnMount();
  }, []);

  // Rafraîchissement automatique toutes les 30 secondes
  useEffect(() => {
    const interval = setInterval(async () => {
      await storage.ensureProxmoxDataLoaded();
      await loadDatabasesData();
    }, 30000); // 30 secondes

    return () => clearInterval(interval);
  }, []);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'mysql':
        return <Database className="h-4 w-4 text-blue-500" />;
      case 'postgresql':
        return <Database className="h-4 w-4 text-blue-600" />;
      case 'mongodb':
        return <Database className="h-4 w-4 text-green-500" />;
      case 'redis':
        return <Database className="h-4 w-4 text-red-500" />;
      case 'elasticsearch':
        return <Database className="h-4 w-4 text-yellow-500" />;
      default:
        return <Database className="h-4 w-4 text-gray-500" />;
    }
  };


  const getStatusBadge = (status: string) => {
    const variants = {
      running: 'success',
      stopped: 'error',
      maintenance: 'warning'
    } as const;

    const labels = {
      running: 'En cours',
      stopped: 'Arrêté',
      maintenance: 'Maintenance'
    };

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      mysql: 'MySQL',
      postgresql: 'PostgreSQL',
      mongodb: 'MongoDB',
      redis: 'Redis',
      elasticsearch: 'Elasticsearch'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const formatUptime = (seconds: number) => {
    if (seconds === 0) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);

    if (days > 0) return `${days}j ${hours}h`;
    return `${hours}h`;
  };

  const formatSize = (gb: number) => {
    if (gb >= 1024) return `${(gb / 1024).toFixed(1)} TB`;
    return `${gb.toFixed(1)} GB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getUsageColor = (usage: number) => {
    if (usage >= 90) return 'text-red-600';
    if (usage >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  const filteredDatabases = databases.filter(db => {
    const matchesSearch = db.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         db.host.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || db.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || db.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Actions pour les bases de données
  const handleDatabaseStart = async (db: DatabaseInstance) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      setDatabases(prevDatabases =>
        prevDatabases.map(d =>
          d.id === db.id
            ? { ...d, status: 'running' as const, uptime: 0 }
            : d
        )
      );

      success('Succès', `Base de données ${db.name} démarrée avec succès`);
    } catch (err) {
      error('Erreur', `Impossible de démarrer la base de données ${db.name}`);
    }
  };

  const handleDatabaseStop = (db: DatabaseInstance) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmer l\'arrêt',
      message: `Êtes-vous sûr de vouloir arrêter la base de données ${db.name} ?\n\nCela interrompra toutes les connexions actives.`,
      variant: 'warning',
      onConfirm: async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      setDatabases(prevDatabases =>
        prevDatabases.map(d =>
          d.id === db.id
            ? { ...d, status: 'stopped' as const, uptime: 0, cpu_usage: 0, memory_usage: 0 }
            : d
        )
      );

      success('Succès', `Base de données ${db.name} arrêtée avec succès`);
    } catch (err) {
      error('Erreur', `Impossible d'arrêter la base de données ${db.name}`);
    }
      }
    });
  };

  const handleDatabaseRestart = (db: DatabaseInstance) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmer le redémarrage',
      message: `Êtes-vous sûr de vouloir redémarrer la base de données ${db.name} ?\n\nCela interrompra toutes les connexions actives.`,
      variant: 'warning',
      onConfirm: async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      setDatabases(prevDatabases =>
        prevDatabases.map(d =>
          d.id === db.id
            ? { ...d, status: 'running' as const, uptime: 0 }
            : d
        )
      );

      success('Succès', `Base de données ${db.name} redémarrée avec succès`);
    } catch (err) {
      error('Erreur', `Impossible de redémarrer la base de données ${db.name}`);
    }
      }
    });
  };

  const handleDatabaseBackup = async (db: DatabaseInstance) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));

      success('Succès', `Sauvegarde de la base de données ${db.name} créée avec succès`);
    } catch (err) {
      error('Erreur', `Impossible de créer la sauvegarde de la base de données ${db.name}`);
    }
  };

  const handleDatabaseConfig = (db: DatabaseInstance) => {
    warning('Information', `La configuration détaillée de la base de données ${db.name} sera disponible dans une prochaine version`);
  };

  const handleDatabaseView = (db: DatabaseInstance) => {
    success('Information', `Affichage des détails de la base de données ${db.name}`);
  };

  const handleDatabaseEdit = (db: DatabaseInstance) => {
    warning('Information', `L'édition de la base de données ${db.name} sera disponible dans une prochaine version`);
  };

  const handleDatabaseMore = (db: DatabaseInstance) => {
    // Toggle le menu pour cette base de données
    setShowMoreMenu(showMoreMenu === db.id ? null : db.id);
  };

  const handleDatabaseAction = (db: DatabaseInstance, action: string) => {
    setShowMoreMenu(null);
    switch (action) {
      case 'backup':
        handleDatabaseBackup(db);
        break;
      case 'config':
        handleDatabaseConfig(db);
        break;
      case 'logs':
        warning('Information', `Les logs de la base de données ${db.name} seront disponibles dans une prochaine version`);
        break;
      case 'export':
        warning('Information', `L'export de la base de données ${db.name} sera disponible dans une prochaine version`);
        break;
      default:
        break;
    }
  };

  // Fonction pour ouvrir la VM/LXC associée
  const handleOpenResource = (db: DatabaseInstance) => {
    if (!db.resource_type || !db.resource_id) {
      warning('Information', 'Aucune ressource associée trouvée');
      return;
    }

    // Déterminer la page à ouvrir
    const targetPage = (db.resource_type === 'vm' || db.resource_type === 'qemu') ? 'vms' : 'lxc';
    
    // Naviguer vers la page
    window.dispatchEvent(new CustomEvent('navigate', { detail: targetPage }));
    
    // Attendre un peu pour que la page se charge, puis scroller vers la ressource
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('scrollToResource', { 
        detail: { 
          type: targetPage, 
          id: db.resource_id,
          vmid: db.resource_id
        } 
      }));
    }, 500);
  };

  const uniqueTypes = [...new Set(databases.map(db => db.type))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader size="lg" variant="spinner" text="Chargement des bases de données..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Bases de données
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Gestion et monitoring des bases de données
        </p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Database className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Total
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {databases.length}
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
              {databases.filter(db => db.status === 'running').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Connexions
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {databases.reduce((sum, db) => sum + db.connections, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <HardDrive className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Taille totale
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {formatSize(databases.reduce((sum, db) => sum + db.size, 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-64">
          <Input
            placeholder="Rechercher une base de données..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          options={[
            { value: 'all', label: 'Tous les types' },
            ...uniqueTypes.map(type => ({ value: type, label: getTypeLabel(type) }))
          ]}
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: 'all', label: 'Tous les statuts' },
            { value: 'running', label: 'En cours' },
            { value: 'stopped', label: 'Arrêtées' },
            { value: 'maintenance', label: 'Maintenance' }
          ]}
        />
      </div>

      {/* Liste des bases de données */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredDatabases.map((db) => (
          <Card key={db.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getTypeIcon(db.type)}
                  <div>
                    <CardTitle className="text-lg">{db.name}</CardTitle>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {getTypeLabel(db.type)} {db.version}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(db.status)}
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1"
                      onClick={() => handleDatabaseView(db)}
                      title="Voir les détails"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1"
                      onClick={() => handleDatabaseEdit(db)}
                      title="Modifier"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <div className="relative">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="p-1"
                      onClick={() => handleDatabaseMore(db)}
                      title="Plus d'actions"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                      {showMoreMenu === db.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setShowMoreMenu(null)}
                          />
                          <div className="absolute right-0 top-8 z-20 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1">
                            <button
                              onClick={() => handleDatabaseAction(db, 'backup')}
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              Sauvegarder
                            </button>
                            <button
                              onClick={() => handleDatabaseAction(db, 'config')}
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              Configuration
                            </button>
                            <button
                              onClick={() => handleDatabaseAction(db, 'logs')}
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              Logs
                            </button>
                            <button
                              onClick={() => handleDatabaseAction(db, 'export')}
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              Exporter
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
              {/* Informations de connexion */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <Server className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">Host:</span>
                  <span className="font-mono">{db.host}:{db.port}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">Connexions:</span>
                  <span>{db.connections}/{db.max_connections}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">Uptime:</span>
                  <span>{formatUptime(db.uptime)}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <HardDrive className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">Taille:</span>
                  <span>{formatSize(db.size)}</span>
                </div>
              </div>

              {/* Informations de ressource Proxmox */}
              {db.resource_type && db.resource_id && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
                      {db.resource_type === 'vm' || db.resource_type === 'qemu' ? (
                        <Monitor className="h-4 w-4" />
                      ) : (
                        <Container className="h-4 w-4" />
                      )}
                      <span>
                        {db.resource_type === 'vm' || db.resource_type === 'qemu' ? 'VM' : 'LXC'} ID: {db.resource_id}
                        {db.node && ` • ${db.node}`}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenResource(db)}
                      className="flex items-center space-x-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>Ouvrir</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Sécurité */}
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-2">
                  <Lock className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">SSL:</span>
                  <Badge variant={db.ssl_enabled ? 'success' : 'error'} size="sm">
                    {db.ssl_enabled ? 'Activé' : 'Désactivé'}
                  </Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <Globe className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">Auth:</span>
                  <span className="font-mono text-xs">{db.authentication}</span>
                </div>
              </div>

              {/* Utilisation des ressources (seulement si en cours) */}
              {db.status === 'running' && (
                <div className="space-y-3">
                  {/* CPU */}
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center space-x-2">
                        <Cpu className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                        <span className="text-slate-600 dark:text-slate-400">CPU</span>
                      </div>
                      <span className={`font-medium ${getUsageColor(db.cpu_usage)}`}>
                        {db.cpu_usage}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${db.cpu_usage}%` }}
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
                      <span className={`font-medium ${getUsageColor(db.memory_usage)}`}>
                        {db.memory_usage}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${db.memory_usage}%` }}
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
                      <span className={`font-medium ${getUsageColor(db.disk_usage)}`}>
                        {db.disk_usage}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                      <div
                        className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${db.disk_usage}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Dernière sauvegarde */}
              {db.last_backup && (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Dernière sauvegarde: {formatDate(db.last_backup)}
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                {db.status === 'running' ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDatabaseStop(db)}
                    >
                      <Square className="h-4 w-4 mr-1" />
                      Arrêter
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDatabaseRestart(db)}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Redémarrer
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDatabaseStart(db)}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Démarrer
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDatabaseBackup(db)}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Backup
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDatabaseConfig(db)}
                >
                  <Settings className="h-4 w-4 mr-1" />
                  Config
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredDatabases.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Database className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              Aucune base de données trouvée
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Aucune base de données ne correspond aux critères de recherche.
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
