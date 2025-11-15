import { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, Activity, ExternalLink, RefreshCw, Search } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { apiGet, apiPost, apiPut, apiDelete, App, CreateAppRequest, HealthStatus } from '@/utils/api';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/hooks/useTranslation';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Loader } from '@/components/ui/Loader';
import { storage } from '@/utils/storage';

interface AppWithHealth extends App {
  health?: HealthStatus;
  resolvedIP?: string;
}

export function Apps() {
  const { t } = useTranslation();
  const [apps, setApps] = useState<AppWithHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingApp, setEditingApp] = useState<App | null>(null);
  const { success, error } = useToast();
  const appsRef = useRef<AppWithHealth[]>([]);
  
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

  const [formData, setFormData] = useState<CreateAppRequest>({
    name: '',
    protocol: 'http',
    host: '',
    port: 80,
    path: '/',
    tag: '',
    icon: 'activity',
    health_path: '/health',
    health_type: 'http',
  });

  const protocolOptions = [
    { value: 'http', label: 'HTTP' },
    { value: 'https', label: 'HTTPS' },
    { value: 'tcp', label: 'TCP' },
  ];

  const healthTypeOptions = [
    { value: 'http', label: 'HTTP' },
    { value: 'tcp', label: 'TCP' },
  ];

  const iconOptions = [
    { value: 'activity', label: 'Activity' },
    { value: 'server', label: 'Server' },
    { value: 'database', label: 'Database' },
    { value: 'globe', label: 'Globe' },
    { value: 'monitor', label: 'Monitor' },
  ];

  // Fonction simplifiée pour trouver l'IP depuis Proxmox
  const findIPFromProxmox = (hostname: string): string | null => {
    const hostnameLower = hostname.replace('.local', '').toLowerCase();
    
    // Chercher dans les VMs
    const savedVMs = localStorage.getItem('proxmoxVMs');
    if (savedVMs) {
      try {
        const vms = JSON.parse(savedVMs);
        const matchingVM = vms.find((vm: any) => {
          if (!vm.name || !vm.ip_address) return false;
          const vmName = vm.name.toLowerCase();
          return vmName === hostnameLower || vmName.includes(hostnameLower) || hostnameLower.includes(vmName);
        });
        if (matchingVM?.ip_address) return matchingVM.ip_address;
      } catch (err) {
        console.error('Erreur lecture VMs:', err);
      }
    }
    
    // Chercher dans les LXC
    const savedLXC = localStorage.getItem('proxmoxLXC');
    if (savedLXC) {
      try {
        const lxc = JSON.parse(savedLXC);
        const matchingLXC = lxc.find((container: any) => {
          if (!container.name || !container.ip_address) return false;
          const containerName = container.name.toLowerCase();
          return containerName === hostnameLower || containerName.includes(hostnameLower) || hostnameLower.includes(containerName);
        });
        if (matchingLXC?.ip_address) return matchingLXC.ip_address;
      } catch (err) {
        console.error('Erreur lecture LXC:', err);
      }
    }
    
    return null;
  };

  // Charger uniquement la liste des applications (sans health checks)
  const loadApps = async () => {
    try {
      setLoading(true);
      await storage.ensureProxmoxDataLoaded();
      
      const appsData = await apiGet<App[]>('/api/v1/apps');

      // Résoudre les IPs
      const appsWithIPs = appsData.map((app) => {
        const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(app.host);
        if (isIP) {
          return { ...app, resolvedIP: app.host };
        }
        const foundIP = findIPFromProxmox(app.host);
        return { ...app, resolvedIP: foundIP || undefined };
      });

      setApps(appsWithIPs);
      appsRef.current = appsWithIPs;
      
      // Charger les health checks de manière asynchrone après l'affichage
      loadHealthChecks(appsWithIPs);
    } catch (err) {
      console.error('Erreur chargement applications:', err);
      error(t('common.error'), t('apps.load_error') || 'Impossible de charger les applications');
    } finally {
      setLoading(false);
    }
  };

  // Charger les health checks de manière asynchrone
  const loadHealthChecks = async (appsToCheck: AppWithHealth[]) => {
    // Ne pas bloquer l'interface, charger en arrière-plan
    const appsWithHealth = await Promise.all(
      appsToCheck.map(async (app) => {
        const targetHost = app.resolvedIP || app.host;
        
        if (!app.resolvedIP && app.host.endsWith('.local')) {
          return {
            ...app,
            health: {
              status: 'offline' as const,
              last_check: new Date().toISOString(),
              error: `IP non trouvée pour ${app.host}`
            }
          };
        }
        
        try {
          const url = `${app.protocol}://${targetHost}:${app.port}${app.health_path}`;
          const health = await apiGet<HealthStatus>(`/api/v1/health/http?url=${encodeURIComponent(url)}`);
          return { ...app, health };
        } catch (err: any) {
          const errorMsg = err?.message || 'Erreur inconnue';
          const isDNSError = errorMsg.includes('no such host') || errorMsg.includes('lookup') || errorMsg.includes('DNS') || errorMsg.includes('.local');
          
          return { 
            ...app, 
            health: { 
              status: isDNSError ? 'offline' as const : 'unknown' as const, 
              last_check: new Date().toISOString(),
              error: isDNSError ? `DNS: ${targetHost} ne peut pas être résolu` : errorMsg
            } 
          };
        }
      })
    );

    // Mettre à jour les apps avec les health checks
    setApps(appsWithHealth);
    appsRef.current = appsWithHealth;
  };

  useEffect(() => {
    loadApps();
  }, []);

  // Rafraîchir les health checks toutes les 30 secondes (sans recharger toute la liste)
  useEffect(() => {
    const interval = setInterval(() => {
      // Charger les health checks pour les apps actuelles (via ref pour avoir la valeur à jour)
      if (appsRef.current.length > 0) {
        loadHealthChecks(appsRef.current);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingApp) {
        await apiPut(`/api/v1/apps/${editingApp.id}`, formData);
        success(t('common.success'), t('apps.updated') || 'Application mise à jour');
      } else {
        await apiPost('/api/v1/apps', formData);
        success(t('common.success'), t('apps.created') || 'Application créée');
      }

      setShowModal(false);
      resetForm();
      loadApps();
    } catch (err) {
      error(t('common.error'), t('apps.save_error') || 'Impossible de sauvegarder l\'application');
    }
  };

  const handleDelete = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmer la suppression',
      message: t('apps.delete_confirm') || 'Êtes-vous sûr de vouloir supprimer cette application ?',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await apiDelete(`/api/v1/apps/${id}`);
          success(t('common.success'), t('apps.deleted') || 'Application supprimée');
          loadApps();
        } catch (err) {
          error(t('common.error'), t('apps.delete_error') || 'Impossible de supprimer l\'application');
        }
      }
    });
  };

  const handleEdit = (app: App) => {
    setEditingApp(app);
    setFormData({
      name: app.name,
      protocol: app.protocol,
      host: app.host,
      port: app.port,
      path: app.path || '/',
      tag: app.tag || '',
      icon: app.icon || 'activity',
      health_path: app.health_path || '/health',
      health_type: app.health_type || 'http',
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingApp(null);
    setFormData({
      name: '',
      protocol: 'http',
      host: '',
      port: 80,
      path: '/',
      tag: '',
      icon: 'activity',
      health_path: '/health',
      health_type: 'http',
    });
  };

  const getStatusBadge = (health?: HealthStatus) => {
    if (!health) {
      return <Badge variant="default" size="sm">Inconnu</Badge>;
    }

    switch (health.status) {
      case 'online':
        return <Badge variant="success" size="sm">En ligne</Badge>;
      case 'offline':
        return <Badge variant="error" size="sm">Hors ligne</Badge>;
      default:
        return <Badge variant="default" size="sm">Inconnu</Badge>;
    }
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

  // Filtres
  const allTags = Array.from(new Set(apps.map(app => app.tag).filter((tag): tag is string => Boolean(tag)))).sort();

  const filteredApps = apps.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         app.host.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (app.tag && app.tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'online' && app.health?.status === 'online') ||
                         (statusFilter === 'offline' && app.health?.status === 'offline') ||
                         (statusFilter === 'unknown' && (!app.health || app.health.status === 'unknown'));
    const matchesTag = tagFilter === 'all' || app.tag === tagFilter;
    return matchesSearch && matchesStatus && matchesTag;
  });

  if (loading && apps.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader size="lg" variant="spinner" text="Chargement des applications..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {t('navigation.apps')}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {t('apps.description') || 'Gérez et surveillez vos applications'}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={loadApps} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('apps.add_app') || 'Ajouter une application'}
          </Button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-64 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
          <Input
            placeholder="Rechercher une application..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: 'all', label: 'Tous les statuts' },
            { value: 'online', label: 'En ligne' },
            { value: 'offline', label: 'Hors ligne' },
            { value: 'unknown', label: 'Inconnu' },
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

      {/* Grille des applications */}
      {filteredApps.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Activity className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              {searchTerm || statusFilter !== 'all' || tagFilter !== 'all'
                ? 'Aucune application trouvée'
                : t('apps.no_apps') || 'Aucune application'}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              {searchTerm || statusFilter !== 'all' || tagFilter !== 'all'
                ? 'Essayez de modifier vos critères de recherche'
                : t('apps.no_apps_description') || 'Commencez par ajouter votre première application à monitorer.'}
            </p>
            {(!searchTerm && statusFilter === 'all' && tagFilter === 'all') && (
              <Button onClick={() => setShowModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('apps.add_app') || 'Ajouter une application'}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredApps.map((app) => (
            <Card key={app.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Activity className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                    <span>{app.name}</span>
                  </CardTitle>
                  {getStatusBadge(app.health)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Informations principales */}
                <div className="space-y-3">
                  {/* URL cliquable */}
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 text-sm">
                      <span className="text-slate-600 dark:text-slate-400">URL:</span>
                      <button
                        onClick={() => {
                          const url = `${app.protocol}://${app.resolvedIP || app.host}:${app.port}${app.path}`;
                          window.open(url, '_blank');
                        }}
                        className="font-mono text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline cursor-pointer flex items-center space-x-1"
                        title={`Ouvrir ${app.protocol}://${app.resolvedIP || app.host}:${app.port}${app.path}`}
                        disabled={!app.resolvedIP && app.host.endsWith('.local')}
                      >
                        <span>{app.resolvedIP || app.host}:{app.port}{app.path !== '/' ? app.path : ''}</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                    
                    {/* IP cliquable si différente du host */}
                    {app.resolvedIP && app.resolvedIP !== app.host && (
                      <div className="flex items-center space-x-2 text-xs">
                        <span className="text-slate-500 dark:text-slate-400">IP:</span>
                        <button
                          onClick={() => {
                            const url = `${app.protocol}://${app.resolvedIP}:${app.port}${app.path}`;
                            window.open(url, '_blank');
                          }}
                          className="font-mono text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline cursor-pointer flex items-center space-x-1"
                          title={`Ouvrir ${app.protocol}://${app.resolvedIP}:${app.port}${app.path}`}
                        >
                          <span>{app.resolvedIP}</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>
                        <span className="text-slate-500 dark:text-slate-400">({app.host})</span>
                      </div>
                    )}
                  </div>

                  {/* Protocole et informations techniques */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-500 dark:text-slate-400">Protocole:</span>
                      <Badge variant="default" size="sm" className="text-xs">
                        {app.protocol.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-500 dark:text-slate-400">Port:</span>
                      <span className="font-medium">{app.port}</span>
                    </div>
                    {app.health_path && (
                      <div className="flex items-center space-x-2 col-span-2">
                        <span className="text-slate-500 dark:text-slate-400">Health check:</span>
                        <span className="font-mono text-xs">{app.health_path}</span>
                        <Badge variant="default" size="sm" className="text-xs">
                          {app.health_type?.toUpperCase() || 'HTTP'}
                        </Badge>
                      </div>
                    )}
                  </div>
                  
                  {app.tag && (
                    <div>
                      <Badge variant="default" size="sm">
                        {app.tag}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Informations de santé */}
                {app.health && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Statut de santé
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                      {app.health.latency !== undefined && (
                        <div className="flex items-center justify-between">
                          <span>Latence:</span>
                          <span className="font-medium">{app.health.latency}ms</span>
                        </div>
                      )}
                      {app.health.status_code && (
                        <div className="flex items-center justify-between">
                          <span>Code HTTP:</span>
                          <Badge 
                            variant={app.health.status_code >= 200 && app.health.status_code < 300 ? 'success' : 'error'} 
                            size="sm"
                            className="text-xs"
                          >
                            {app.health.status_code}
                          </Badge>
                        </div>
                      )}
                      {app.health.last_check && (
                        <div className="flex items-center justify-between">
                          <span>Dernière vérification:</span>
                          <span className="font-medium">{formatDate(app.health.last_check)}</span>
                        </div>
                      )}
                      {app.health.error && (
                        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-600 dark:text-red-400 text-xs">
                          {app.health.error}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(app)}
                    className="p-1"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(app.id)}
                    className="p-1 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de création/édition */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title={editingApp ? (t('apps.edit_app') || 'Modifier l\'application') : (t('apps.add_app') || 'Ajouter une application')}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={t('apps.form.name') || 'Nom'}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Select
              label={t('apps.form.protocol') || 'Protocole'}
              value={formData.protocol}
              onChange={(e) => setFormData({ ...formData, protocol: e.target.value })}
              options={protocolOptions}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={t('apps.form.host') || 'Hôte'}
              value={formData.host}
              onChange={(e) => setFormData({ ...formData, host: e.target.value })}
              placeholder="192.168.1.100 ou hostname"
              required
            />
            <Input
              label={t('apps.form.port') || 'Port'}
              type="number"
              value={formData.port}
              onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
              required
            />
          </div>

          <Input
            label={t('apps.form.path') || 'Chemin'}
            value={formData.path}
            onChange={(e) => setFormData({ ...formData, path: e.target.value })}
            placeholder="/"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={t('apps.form.tag') || 'Tag'}
              value={formData.tag}
              onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
              placeholder="production, dev, etc."
            />
            <Select
              label={t('apps.form.icon') || 'Icône'}
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              options={iconOptions}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={t('apps.form.health_path') || 'Chemin de santé'}
              value={formData.health_path}
              onChange={(e) => setFormData({ ...formData, health_path: e.target.value })}
              placeholder="/health"
            />
            <Select
              label={t('apps.form.health_type') || 'Type de santé'}
              value={formData.health_type}
              onChange={(e) => setFormData({ ...formData, health_type: e.target.value })}
              options={healthTypeOptions}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowModal(false);
                resetForm();
              }}
            >
              {t('apps.form.cancel') || t('common.cancel') || 'Annuler'}
            </Button>
            <Button type="submit">
              {editingApp ? (t('apps.form.update') || 'Mettre à jour') : (t('apps.form.create') || 'Créer')}
            </Button>
          </div>
        </form>
      </Modal>

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
