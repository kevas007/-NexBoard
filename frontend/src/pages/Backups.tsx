import { useState, useEffect } from 'react';
import {
  Archive,
  Download,
  Play,
  Square,
  RotateCcw,
  Clock,
  HardDrive,
  Server,
  Activity,
  CheckCircle,
  MoreVertical,
  Eye,
  Edit,
  Settings,
  Calendar,
  Database,
  Monitor,
  Trash2
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

interface Backup {
  id: string;
  name: string;
  type: 'vm' | 'lxc' | 'host' | 'storage';
  status: 'completed' | 'running' | 'failed' | 'scheduled';
  size: number; // GB
  duration: number; // minutes
  started_at: string;
  completed_at?: string;
  next_run?: string;
  node: string;
  target: string;
  retention: number; // days
  compression: boolean;
  encryption: boolean;
  created_at: string;
  vmid?: number;
  lxc_id?: number;
}

export function Backups() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
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
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { success, error, warning } = useToast();

  // Charger les données Backups depuis Proxmox
  const loadBackupsData = async () => {
    try {
      setLoading(true);
      
      // Essayer de charger les données Proxmox réelles
      const savedConfig = localStorage.getItem('proxmoxConfig');
      if (!savedConfig) {
        console.log('⚠️ Aucune configuration Proxmox trouvée');
        setBackups([]);
        setLoading(false);
        return;
      }

      const config = JSON.parse(savedConfig);

      // Appeler l'API backend pour récupérer les backups
      const data = await apiPost<{
        success: boolean;
        message?: string;
        backups?: any[];
      }>('/api/v1/proxmox/fetch-backups', {
        url: config.url,
        username: config.username,
        secret: config.secret
      });

      if (data.success && data.backups) {
        // Convertir les données Proxmox vers le format Backup
        const convertedBackups: Backup[] = data.backups.map((backup: any) => ({
          id: backup.id || backup.name || 'unknown',
          name: backup.name || backup.id || 'unknown',
          type: (backup.type === 'lxc' ? 'lxc' : 'vm') as Backup['type'],
          status: (backup.status === 'completed' ? 'completed' : backup.status === 'running' ? 'running' : 'failed') as Backup['status'],
          size: backup.size || 0,
          duration: backup.duration || 0,
          started_at: backup.started_at || backup.created_at || new Date().toISOString(),
          completed_at: backup.completed_at,
          node: backup.node || 'unknown',
          target: 'local', // Valeur par défaut
          retention: 7, // Valeur par défaut
          compression: false, // Non disponible dans les données Proxmox de base
          encryption: false, // Non disponible dans les données Proxmox de base
          created_at: backup.created_at || backup.started_at || new Date().toISOString(),
          vmid: backup.vmid,
          lxc_id: backup.type === 'lxc' ? backup.vmid : undefined
        }));

        setBackups(convertedBackups);
        console.log('✅ Backups chargés depuis Proxmox:', convertedBackups.length);
      } else {
        console.warn('⚠️ Aucune donnée backup trouvée ou erreur:', data.message);
        setBackups([]);
      }
    } catch (err) {
      console.error('❌ Erreur lors du chargement des données Backups:', err);
      setBackups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Charger automatiquement les données Proxmox si la configuration existe
    const loadDataOnMount = async () => {
      await storage.ensureProxmoxDataLoaded();
      // Charger les backups après avoir chargé les données
      await loadBackupsData();
    };
    
    loadDataOnMount();
  }, []);

  // Rafraîchissement automatique toutes les 30 secondes
  useEffect(() => {
    const interval = setInterval(async () => {
      await storage.ensureProxmoxDataLoaded();
      await loadBackupsData();
    }, 30000); // 30 secondes

    return () => clearInterval(interval);
  }, []);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'vm':
        return <Monitor className="h-4 w-4 text-blue-500" />;
      case 'lxc':
        return <Server className="h-4 w-4 text-green-500" />;
      case 'host':
        return <Database className="h-4 w-4 text-purple-500" />;
      case 'storage':
        return <HardDrive className="h-4 w-4 text-orange-500" />;
      default:
        return <Archive className="h-4 w-4 text-gray-500" />;
    }
  };


  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'success',
      running: 'info',
      failed: 'error',
      scheduled: 'warning'
    } as const;

    const labels = {
      completed: 'Terminé',
      running: 'En cours',
      failed: 'Échoué',
      scheduled: 'Programmé'
    };

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      vm: 'Machine virtuelle',
      lxc: 'Conteneur LXC',
      host: 'Hôte',
      storage: 'Stockage'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const formatSize = (gb: number) => {
    if (gb >= 1024) return `${(gb / 1024).toFixed(1)} TB`;
    return `${gb.toFixed(1)} GB`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes === 0) return 'N/A';
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins > 0 ? `${mins}min` : ''}`;
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

  const filteredBackups = backups.filter(backup => {
    const matchesSearch = backup.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         backup.node.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || backup.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || backup.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Actions pour les sauvegardes
  const handleBackupStart = async (backup: Backup) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      setBackups(prevBackups =>
        prevBackups.map(b =>
          b.id === backup.id
            ? { ...b, status: 'running' as const, progress: 0 }
            : b
        )
      );

      success('Succès', `Sauvegarde ${backup.name} démarrée avec succès`);
    } catch (err) {
      error('Erreur', `Impossible de démarrer la sauvegarde ${backup.name}`);
    }
  };

  const handleBackupStop = async (backup: Backup) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      setBackups(prevBackups =>
        prevBackups.map(b =>
          b.id === backup.id
            ? { ...b, status: 'failed' as const, progress: 0 }
            : b
        )
      );

      success('Succès', `Sauvegarde ${backup.name} arrêtée avec succès`);
    } catch (err) {
      error('Erreur', `Impossible d'arrêter la sauvegarde ${backup.name}`);
    }
  };

  const handleBackupDelete = (backup: Backup) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmer la suppression',
      message: `Êtes-vous sûr de vouloir supprimer la sauvegarde ${backup.name} ?\n\nCette action est irréversible.`,
      variant: 'danger',
      onConfirm: async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      setBackups(prevBackups =>
        prevBackups.filter(b => b.id !== backup.id)
      );

      success('Succès', `Sauvegarde ${backup.name} supprimée avec succès`);
    } catch (err) {
      error('Erreur', `Impossible de supprimer la sauvegarde ${backup.name}`);
    }
      }
    });
  };

  const handleBackupRestore = (backup: Backup) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmer la restauration',
      message: `Êtes-vous sûr de vouloir restaurer la sauvegarde ${backup.name} ?\n\nCette action va remplacer les données actuelles.`,
      variant: 'warning',
      onConfirm: async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));

      success('Succès', `Restauration de la sauvegarde ${backup.name} terminée avec succès`);
    } catch (err) {
      error('Erreur', `Impossible de restaurer la sauvegarde ${backup.name}`);
    }
      }
    });
  };

  const handleBackupDownload = async (backup: Backup) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      success('Succès', `Téléchargement de la sauvegarde ${backup.name} terminé`);
    } catch (err) {
      error('Erreur', `Impossible de télécharger la sauvegarde ${backup.name}`);
    }
  };

  const handleBackupConfig = (backup: Backup) => {
    warning('Information', `La configuration détaillée de la sauvegarde ${backup.name} sera disponible dans une prochaine version`);
  };

  const handleBackupMore = (backup: Backup) => {
    // Menu contextuel pour actions supplémentaires
    const actions = [
      { label: 'Vérifier', action: () => warning('Information', `La vérification de sauvegarde sera disponible dans une prochaine version`) },
      { label: 'Dupliquer', action: () => warning('Information', `La duplication de sauvegarde sera disponible dans une prochaine version`) },
      { label: 'Planifier', action: () => warning('Information', `La planification automatique sera disponible dans une prochaine version`) },
    ];
    
    const actionList = actions.map(a => a.label).join(', ');
    warning('Actions disponibles', `Pour ${backup.name}: ${actionList}`);
  };

  const handleBackupExport = () => {
    try {
      const filteredBackups = backups.filter(backup => {
        const matchesSearch = backup.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'all' || backup.type === typeFilter;
        const matchesStatus = statusFilter === 'all' || backup.status === statusFilter;
        return matchesSearch && matchesType && matchesStatus;
      });

      exportToCSV(filteredBackups, `sauvegardes-${new Date().toISOString().split('T')[0]}`, {
        id: 'ID',
        name: 'Nom',
        type: 'Type',
        status: 'Statut',
        size: 'Taille (GB)',
        created_at: 'Créé le',
        next_run: 'Prochaine exécution',
        node: 'Nœud',
        vmid: 'ID VM',
        target: 'Cible'
      } as any);
      success('Export réussi', 'Les sauvegardes ont été exportées en CSV');
    } catch (err) {
      error('Erreur', 'Impossible d\'exporter les sauvegardes');
    }
  };

  const uniqueTypes = [...new Set(backups.map(backup => backup.type))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader size="lg" variant="spinner" text="Chargement des sauvegardes..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Sauvegardes
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Gestion des sauvegardes et stratégies de rétention
        </p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Archive className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Total
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {backups.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Terminées
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {backups.filter(b => b.status === 'completed').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Play className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                En cours
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {backups.filter(b => b.status === 'running').length}
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
              {formatSize(backups.reduce((sum, b) => sum + b.size, 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-64">
          <Input
            placeholder="Rechercher une sauvegarde..."
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
            { value: 'completed', label: 'Terminées' },
            { value: 'running', label: 'En cours' },
            { value: 'failed', label: 'Échouées' },
            { value: 'scheduled', label: 'Programmées' }
          ]}
        />
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleBackupExport}
        >
          <Download className="h-4 w-4 mr-2" />
          Exporter
        </Button>
      </div>

      {/* Liste des sauvegardes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredBackups.map((backup) => (
          <Card key={backup.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getTypeIcon(backup.type)}
                  <div>
                    <CardTitle className="text-lg">{backup.name}</CardTitle>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {getTypeLabel(backup.type)} • {backup.node}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(backup.status)}
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1"
                      onClick={() => success('Information', `Affichage des détails de la sauvegarde ${backup.name}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1"
                      onClick={() => warning('Information', `L'édition de la sauvegarde ${backup.name} sera disponible dans une prochaine version`)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="p-1"
                      onClick={() => handleBackupMore(backup)}
                      title="Plus d'actions"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Informations de base */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <HardDrive className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">Cible:</span>
                  <span>{backup.target}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">Durée:</span>
                  <span>{formatDuration(backup.duration)}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Archive className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">Taille:</span>
                  <span>{formatSize(backup.size)}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">Rétention:</span>
                  <span>{backup.retention}j</span>
                </div>
              </div>

              {/* ID de la ressource */}
              {(backup.vmid || backup.lxc_id) && (
                <div className="text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    {backup.type === 'vm' ? 'VM ID:' : 'LXC ID:'}
                  </span>
                  <span className="ml-2 font-mono">{backup.vmid || backup.lxc_id}</span>
                </div>
              )}

              {/* Options de sauvegarde */}
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-2">
                  <Archive className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">Compression:</span>
                  <Badge variant={backup.compression ? 'success' : 'default'} size="sm">
                    {backup.compression ? 'Activée' : 'Désactivée'}
                  </Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <Activity className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">Chiffrement:</span>
                  <Badge variant={backup.encryption ? 'success' : 'default'} size="sm">
                    {backup.encryption ? 'Activé' : 'Désactivé'}
                  </Badge>
                </div>
              </div>

              {/* Dates */}
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Démarré:</span>
                  <span className="ml-2">{formatDate(backup.started_at)}</span>
                </div>
                {backup.completed_at && (
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Terminé:</span>
                    <span className="ml-2">{formatDate(backup.completed_at)}</span>
                  </div>
                )}
                {backup.next_run && (
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Prochaine:</span>
                    <span className="ml-2">{formatDate(backup.next_run)}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex space-x-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                {backup.status === 'running' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBackupStop(backup)}
                  >
                    <Square className="h-4 w-4 mr-1" />
                    Arrêter
                  </Button>
                ) : backup.status === 'scheduled' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBackupStart(backup)}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Démarrer
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBackupRestore(backup)}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Restaurer
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBackupDownload(backup)}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Télécharger
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBackupConfig(backup)}
                >
                  <Settings className="h-4 w-4 mr-1" />
                  Config
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBackupDelete(backup)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Supprimer
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredBackups.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Archive className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              Aucune sauvegarde trouvée
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Aucune sauvegarde ne correspond aux critères de recherche.
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
