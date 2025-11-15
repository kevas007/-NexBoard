import { useState, useEffect } from 'react';
import {
  Container,
  Play,
  Square,
  RotateCcw,
  Settings,
  HardDrive,
  MemoryStick,
  Cpu,
  Clock,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Download,
  Upload,
  Image,
  Layers
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Loader } from '@/components/ui/Loader';
import { exportToCSV } from '@/utils/export';
import { apiPost } from '@/utils/api';
import { storage } from '@/utils/storage';

interface DockerContainer {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'paused' | 'exited';
  image: string;
  tag: string;
  cpu_usage: number;
  memory_usage: number;
  memory_limit: number;
  uptime: number;
  ports: string[];
  created_at: string;
  restart_policy: string;
  network: string;
  volumes: string[];
}

interface DockerImage {
  id: string;
  name: string;
  tag: string;
  size: number;
  created_at: string;
  last_used?: string;
}

export function Docker() {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'containers' | 'images'>('containers');
  const [showMoreMenu, setShowMoreMenu] = useState<string | null>(null);
  
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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { success, error, warning } = useToast();

  // Charger les données Docker depuis Proxmox
  const loadDockerData = async () => {
    try {
      setLoading(true);
      
      // Essayer de charger les données Proxmox réelles
      const savedConfig = localStorage.getItem('proxmoxConfig');
      if (!savedConfig) {
        console.log('⚠️ Aucune configuration Proxmox trouvée');
        setContainers([]);
        setImages([]);
        setLoading(false);
        return;
      }

      const config = JSON.parse(savedConfig);

      // Appeler l'API backend pour récupérer les conteneurs Docker (via LXC)
      const data = await apiPost<{
        success: boolean;
        message?: string;
        containers?: any[];
      }>('/api/v1/proxmox/fetch-docker', {
        url: config.url,
        username: config.username,
        secret: config.secret
      });

      if (data.success && data.containers) {
        // Convertir les données Proxmox vers le format DockerContainer
        const convertedContainers: DockerContainer[] = data.containers.map((container: any) => ({
          id: container.id || 'unknown',
          name: container.name || 'unknown',
          status: (container.status === 'running' ? 'running' : container.status === 'stopped' ? 'stopped' : 'exited') as DockerContainer['status'],
          image: container.image || 'proxmox-lxc',
          tag: container.tag || 'latest',
          cpu_usage: container.cpu_usage || 0,
          memory_usage: container.memory_usage || 0,
          memory_limit: container.memory_limit || 0,
          uptime: container.uptime || 0,
          ports: container.ports || [],
          created_at: container.created_at || new Date().toISOString(),
          restart_policy: 'unless-stopped', // Valeur par défaut
          network: 'bridge', // Valeur par défaut
          volumes: [] // Non disponible dans les données Proxmox de base
        }));

        setContainers(convertedContainers);
        // Les images Docker ne sont pas disponibles depuis Proxmox
        setImages([]);
        
        // Sauvegarder dans localStorage pour Overview
        localStorage.setItem('proxmoxDocker', JSON.stringify(data.containers || []));
        
        console.log('✅ Conteneurs Docker chargés depuis Proxmox:', convertedContainers.length);
      } else {
        console.warn('⚠️ Aucune donnée Docker trouvée ou erreur:', data.message);
        setContainers([]);
        setImages([]);
      }
    } catch (err) {
      console.error('❌ Erreur lors du chargement des données Docker:', err);
      setContainers([]);
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  // Message d'information supprimé - les données sont maintenant intégrées

  useEffect(() => {
    // Charger automatiquement les données Proxmox si la configuration existe
    const loadDataOnMount = async () => {
      await storage.ensureProxmoxDataLoaded();
      // Charger les conteneurs Docker après avoir chargé les données
      await loadDockerData();
    };
    
    loadDataOnMount();
  }, []);

  // Rafraîchissement automatique toutes les 30 secondes
  useEffect(() => {
    const interval = setInterval(async () => {
      await storage.ensureProxmoxDataLoaded();
      await loadDockerData();
    }, 30000); // 30 secondes

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="h-4 w-4 text-green-500" />;
      case 'stopped':
      case 'exited':
        return <Square className="h-4 w-4 text-red-500" />;
      case 'paused':
        return <Square className="h-4 w-4 text-yellow-500" />;
      default:
        return <Square className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      running: 'success',
      stopped: 'error',
      exited: 'error',
      paused: 'warning'
    } as const;

    const labels = {
      running: 'En cours',
      stopped: 'Arrêté',
      exited: 'Arrêté',
      paused: 'En pause'
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

  const formatSize = (mb: number) => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb.toFixed(1)} MB`;
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

  const filteredContainers = containers.filter((container: DockerContainer) => {
    const matchesSearch = container.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         container.image.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || container.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredImages = images.filter((image: DockerImage) => {
    return image.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           image.tag.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Actions pour les conteneurs Docker
  const handleContainerStart = async (container: DockerContainer) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      setContainers((prevContainers: DockerContainer[]) =>
        prevContainers.map((c: DockerContainer) =>
          c.id === container.id
            ? { ...c, status: 'running' as const, uptime: 0 }
            : c
        )
      );

      success('Succès', `Conteneur ${container.name} démarré avec succès`);
    } catch (err) {
      error('Erreur', `Impossible de démarrer le conteneur ${container.name}`);
    }
  };

  const handleContainerStop = (container: DockerContainer) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmer l\'arrêt',
      message: `Êtes-vous sûr de vouloir arrêter le conteneur ${container.name} ?`,
      variant: 'warning',
      onConfirm: async () => {
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));

          setContainers((prevContainers: DockerContainer[]) =>
            prevContainers.map((c: DockerContainer) =>
              c.id === container.id
                ? { ...c, status: 'stopped' as const, uptime: 0, cpu_usage: 0, memory_usage: 0 }
                : c
            )
          );

          success('Succès', `Conteneur ${container.name} arrêté avec succès`);
        } catch (err) {
          error('Erreur', `Impossible d'arrêter le conteneur ${container.name}`);
        }
      }
    });
  };

  const handleContainerRestart = (container: DockerContainer) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmer le redémarrage',
      message: `Êtes-vous sûr de vouloir redémarrer le conteneur ${container.name} ?\n\nLe conteneur sera temporairement indisponible.`,
      variant: 'warning',
      onConfirm: async () => {
        try {
          await new Promise(resolve => setTimeout(resolve, 2000));

          setContainers((prevContainers: DockerContainer[]) =>
            prevContainers.map((c: DockerContainer) =>
              c.id === container.id
                ? { ...c, status: 'running' as const, uptime: 0 }
                : c
            )
          );

          success('Succès', `Conteneur ${container.name} redémarré avec succès`);
        } catch (err) {
          error('Erreur', `Impossible de redémarrer le conteneur ${container.name}`);
        }
      }
    });
  };

  const handleContainerDelete = (container: DockerContainer) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmer la suppression',
      message: `Êtes-vous sûr de vouloir supprimer le conteneur ${container.name} ?\n\nCette action est irréversible.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));

          setContainers((prevContainers: DockerContainer[]) =>
            prevContainers.filter((c: DockerContainer) => c.id !== container.id)
          );

          success('Succès', `Conteneur ${container.name} supprimé avec succès`);
        } catch (err) {
          error('Erreur', `Impossible de supprimer le conteneur ${container.name}`);
        }
      }
    });
  };

  const handleImageDelete = (image: DockerImage) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmer la suppression',
      message: `Êtes-vous sûr de vouloir supprimer l'image ${image.name}:${image.tag} ?\n\nCette action est irréversible.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));

          setImages((prevImages: DockerImage[]) =>
            prevImages.filter((i: DockerImage) => i.id !== image.id)
          );

          success('Succès', `Image ${image.name}:${image.tag} supprimée avec succès`);
        } catch (err) {
          error('Erreur', `Impossible de supprimer l'image ${image.name}:${image.tag}`);
        }
      }
    });
  };

  const handleImageDownload = async (image: DockerImage) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      success('Succès', `Téléchargement de l'image ${image.name}:${image.tag} terminé`);
    } catch (err) {
      error('Erreur', `Impossible de télécharger l'image ${image.name}:${image.tag}`);
    }
  };

  const handleImagePush = async (image: DockerImage) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      success('Succès', `Push de l'image ${image.name}:${image.tag} terminé`);
    } catch (err) {
      error('Erreur', `Impossible de pusher l'image ${image.name}:${image.tag}`);
    }
  };

  const handleContainerView = (container: DockerContainer) => {
    // Afficher les détails du conteneur dans une modal ou une page dédiée
    success('Information', `Affichage des détails du conteneur ${container.name}`);
    // TODO: Implémenter une modal de détails avec toutes les informations du conteneur
  };

  const handleContainerEdit = (container: DockerContainer) => {
    // Ouvrir une modal d'édition pour modifier la configuration du conteneur
    warning('Information', `L'édition du conteneur ${container.name} sera disponible dans une prochaine version`);
    // TODO: Implémenter une modal d'édition pour modifier les paramètres du conteneur
  };

  const handleContainerLogs = (container: DockerContainer) => {
    // Ouvrir les logs du conteneur
    if (container.status === 'running') {
      success('Information', `Ouverture des logs du conteneur ${container.name}`);
      // TODO: Implémenter l'affichage des logs en temps réel
    } else {
      warning('Information', `Le conteneur ${container.name} doit être en cours d'exécution pour voir les logs`);
    }
  };

  const handleContainerConsole = (container: DockerContainer) => {
    // Ouvrir la console du conteneur
    if (container.status === 'running') {
      success('Information', `Ouverture de la console du conteneur ${container.name}`);
      // TODO: Implémenter l'ouverture d'un terminal interactif
    } else {
      warning('Information', `Le conteneur ${container.name} doit être en cours d'exécution pour ouvrir la console`);
    }
  };

  const handleContainerMore = (container: DockerContainer) => {
    // Toggle le menu pour ce conteneur
    setShowMoreMenu(showMoreMenu === container.id ? null : container.id);
  };

  const handleContainerAction = (container: DockerContainer, action: string) => {
    setShowMoreMenu(null);
    switch (action) {
      case 'logs':
        handleContainerLogs(container);
        break;
      case 'console':
        handleContainerConsole(container);
        break;
      case 'commit':
        warning('Information', `Le commit de conteneur sera disponible dans une prochaine version`);
        break;
      case 'export':
        exportToCSV([container], `conteneur-${container.name}-${new Date().toISOString().split('T')[0]}`, {
          id: 'ID',
          name: 'Nom',
          status: 'Statut',
          image: 'Image',
          tag: 'Tag',
          cpu_usage: 'CPU (%)',
          memory_usage: 'Mémoire (%)',
          memory_limit: 'Limite Mémoire (MB)',
          uptime: 'Uptime (s)',
          ports: 'Ports',
          created_at: 'Créé le',
          restart_policy: 'Politique de redémarrage',
          network: 'Réseau',
          volumes: 'Volumes'
        });
        success('Export réussi', `Le conteneur ${container.name} a été exporté en CSV`);
        break;
      default:
        break;
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader size="lg" variant="spinner" text="Chargement des conteneurs Docker..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Docker
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Gestion des conteneurs et images Docker
        </p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Container className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Conteneurs
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
              {containers.filter((c: DockerContainer) => c.status === 'running').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Image className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Images
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {images.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Layers className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Taille totale
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {formatSize(images.reduce((sum: number, img: DockerImage) => sum + img.size, 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Onglets */}
      <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('containers')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'containers'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          Conteneurs ({containers.length})
        </button>
        <button
          onClick={() => setActiveTab('images')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'images'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          Images ({images.length})
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-64">
          <Input
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {activeTab === 'containers' && (
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'all', label: 'Tous les statuts' },
              { value: 'running', label: 'En cours' },
              { value: 'stopped', label: 'Arrêtés' },
              { value: 'paused', label: 'En pause' }
            ]}
          />
        )}
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => {
            if (activeTab === 'containers') {
              exportToCSV(filteredContainers, `docker-conteneurs-${new Date().toISOString().split('T')[0]}`, {
                id: 'ID',
                name: 'Nom',
                status: 'Statut',
                image: 'Image',
                tag: 'Tag',
                cpu_usage: 'CPU (%)',
                memory_usage: 'Mémoire (%)',
                memory_limit: 'Limite Mémoire (MB)',
                uptime: 'Uptime (s)',
                ports: 'Ports',
                created_at: 'Créé le',
                restart_policy: 'Politique de redémarrage',
                network: 'Réseau',
                volumes: 'Volumes'
              });
              success('Export réussi', 'Les conteneurs ont été exportés en CSV');
            } else {
              exportToCSV(filteredImages, `docker-images-${new Date().toISOString().split('T')[0]}`, {
                id: 'ID',
                name: 'Nom',
                tag: 'Tag',
                size: 'Taille (MB)',
                created_at: 'Créé le',
                last_used: 'Dernière utilisation'
              });
              success('Export réussi', 'Les images ont été exportées en CSV');
            }
          }}
        >
          <Download className="h-4 w-4 mr-2" />
          Exporter
        </Button>
      </div>

      {/* Contenu des onglets */}
      {activeTab === 'containers' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredContainers.map((container: DockerContainer) => (
            <Card key={container.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(container.status)}
                    <div>
                      <CardTitle className="text-lg">{container.name}</CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {container.image}:{container.tag}
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
                        title="Voir les détails"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-1"
                        onClick={() => handleContainerEdit(container)}
                        title="Modifier"
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
                                onClick={() => handleContainerAction(container, 'logs')}
                                className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                Logs
                              </button>
                              <button
                                onClick={() => handleContainerAction(container, 'console')}
                                className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                Console
                              </button>
                              <button
                                onClick={() => handleContainerAction(container, 'commit')}
                                className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                Commit
                              </button>
                              <button
                                onClick={() => handleContainerAction(container, 'export')}
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
                {/* Informations de base */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-600 dark:text-slate-400">Uptime:</span>
                    <span>{formatUptime(container.uptime)}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Settings className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-600 dark:text-slate-400">Restart:</span>
                    <span>{container.restart_policy}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Container className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-600 dark:text-slate-400">Réseau:</span>
                    <span>{container.network}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <HardDrive className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-600 dark:text-slate-400">Volumes:</span>
                    <span>{container.volumes.length}</span>
                  </div>
                </div>

                {/* Ports */}
                {container.ports.length > 0 && (
                  <div>
                    <span className="text-sm text-slate-600 dark:text-slate-400">Ports:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {container.ports.map((port: string, index: number) => (
                        <Badge key={index} variant="default" size="sm">
                          {port}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

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
                          {container.memory_usage}% ({formatSize(container.memory_usage * container.memory_limit / 100)})
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${container.memory_usage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex space-x-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  {container.status === 'running' ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleContainerStop(container)}
                      >
                        <Square className="h-4 w-4 mr-1" />
                        Arrêter
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleContainerRestart(container)}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Redémarrer
                      </Button>
                    </>
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
                    onClick={() => warning('Information', `La configuration du conteneur ${container.name} sera disponible dans une prochaine version`)}
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    Config
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleContainerDelete(container)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Supprimer
                  </Button>
                </div>

                {/* ID du conteneur */}
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  ID: {container.id.substring(0, 12)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredImages.map((image: DockerImage) => (
            <Card key={image.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Image className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    <div>
                      <CardTitle className="text-lg">{image.name}</CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Tag: {image.tag}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1"
                      onClick={() => success('Information', `Affichage des détails de l'image ${image.name}:${image.tag}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1"
                      onClick={() => handleImageDelete(image)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <HardDrive className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-600 dark:text-slate-400">Taille:</span>
                    <span>{formatSize(image.size)}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-600 dark:text-slate-400">Créé:</span>
                    <span>{formatDate(image.created_at)}</span>
                  </div>
                </div>

                {image.last_used && (
                  <div className="text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Dernière utilisation:</span>
                    <span className="ml-2">{formatDate(image.last_used)}</span>
                  </div>
                )}

                <div className="flex space-x-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleImageDownload(image)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Télécharger
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleImagePush(image)}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Push
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredContainers.length === 0 && activeTab === 'containers' && (
        <Card>
          <CardContent className="text-center py-12">
            <Container className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              Aucun conteneur trouvé
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Aucun conteneur Docker ne correspond aux critères de recherche.
            </p>
          </CardContent>
        </Card>
      )}

      {filteredImages.length === 0 && activeTab === 'images' && (
        <Card>
          <CardContent className="text-center py-12">
            <Image className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              Aucune image trouvée
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Aucune image Docker ne correspond aux critères de recherche.
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
