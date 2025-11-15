import { useState, useEffect } from 'react';
import { Clock, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { storage } from '@/utils/storage';

export function CacheIndicator() {
  const [cacheStatus, setCacheStatus] = useState<{
    isValid: boolean;
    timestamp: number | null;
    expires: number | null;
  }>({
    isValid: false,
    timestamp: null,
    expires: null
  });

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const updateCacheStatus = () => {
      const data = storage.getProxmoxData();
      setCacheStatus({
        isValid: storage.isProxmoxDataValid(),
        timestamp: data?.timestamp || null,
        expires: data?.expires || null
      });
    };

    // Mise à jour initiale
    updateCacheStatus();

    // Écouter les mises à jour des données
    const handleDataUpdate = () => {
      updateCacheStatus();
    };

    window.addEventListener('proxmoxDataUpdated', handleDataUpdate);

    return () => {
      window.removeEventListener('proxmoxDataUpdated', handleDataUpdate);
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Déclencher un rafraîchissement
      window.dispatchEvent(new CustomEvent('proxmoxDataRefreshNeeded'));

      // Attendre un peu pour que les données se mettent à jour
      setTimeout(() => {
        setRefreshing(false);
      }, 2000);
    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
      setRefreshing(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes} min`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Il y a ${hours}h`;

    const days = Math.floor(hours / 24);
    return `Il y a ${days}j`;
  };

  const getTimeUntilExpiry = () => {
    if (!cacheStatus.expires) return null;

    const now = Date.now();
    const diff = cacheStatus.expires - now;

    if (diff <= 0) return 'Expiré';

    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return 'Expire bientôt';
    if (minutes < 60) return `Expire dans ${minutes} min`;

    const hours = Math.floor(minutes / 60);
    return `Expire dans ${hours}h`;
  };

  return (
    <div className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border">
      <div className="flex items-center space-x-2">
        {cacheStatus.isValid ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
        )}

        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Cache Proxmox
        </span>
      </div>

      <Badge
        variant={cacheStatus.isValid ? 'success' : 'warning'}
        size="sm"
      >
        {cacheStatus.isValid ? 'Valide' : 'Expiré'}
      </Badge>

      {cacheStatus.timestamp && (
        <div className="flex items-center space-x-1 text-xs text-slate-500 dark:text-slate-400">
          <Clock className="h-3 w-3" />
          <span>{formatTime(cacheStatus.timestamp)}</span>
        </div>
      )}

      {cacheStatus.expires && (
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {getTimeUntilExpiry()}
        </div>
      )}

      <Button
        onClick={handleRefresh}
        disabled={refreshing}
        variant="outline"
        size="sm"
        className="ml-auto"
      >
        <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
        Rafraîchir
      </Button>
    </div>
  );
}
