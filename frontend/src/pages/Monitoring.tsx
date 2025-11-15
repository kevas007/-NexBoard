import { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Activity, Cpu, MemoryStick, HardDrive, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Loader } from '@/components/ui/Loader';
import { useTranslation } from '@/hooks/useTranslation';

interface PromResult {
  status: string;
  data?: { result: Array<{ value: [number, string] }> };
  error?: string;
}

export function Monitoring() {
  const { t } = useTranslation();
  const { error, warning, success } = useToast();
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [cpu, setCpu] = useState<number | null>(null);
  const [mem, setMem] = useState<number | null>(null);
  const [disk, setDisk] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Charger la configuration Prometheus depuis localStorage
  useEffect(() => {
    const loadConfig = () => {
      const saved = localStorage.getItem('prometheusConfig');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed?.url) {
            setBaseUrl(parsed.url);
          }
        } catch {}
      }
    };

    loadConfig();

    // Écouter les changements de configuration (depuis Settings)
    const handleConfigUpdate = (e: CustomEvent) => {
      if (e.detail?.url) {
        setBaseUrl(e.detail.url);
      } else {
        loadConfig();
      }
    };

    // Écouter les changements de localStorage (depuis d'autres onglets)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'prometheusConfig') {
        loadConfig();
      }
    };

    window.addEventListener('prometheusConfigUpdated', handleConfigUpdate as EventListener);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('prometheusConfigUpdated', handleConfigUpdate as EventListener);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const q = useMemo(() => ({
    // Moyenne CPU 1m de tous les nœuds
    cpu: 'avg(rate(node_cpu_seconds_total{mode!="idle"}[1m])) * 100',
    // RAM utilisée en pourcentage si node_exporter présent
    mem: '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100',
    // Utilisation disque root si exposée
    disk: '(node_filesystem_size_bytes{mountpoint="/"} - node_filesystem_free_bytes{mountpoint="/"}) / node_filesystem_size_bytes{mountpoint="/"} * 100'
  }), []);

  const runQuery = async (query: string): Promise<number | null> => {
    try {
      // Utiliser des URLs relatives pour compatibilité Docker (nginx proxy /api vers backend)
      // En développement, Vite proxy aussi /api vers localhost:8080
      const apiBaseUrl = import.meta.env.VITE_API_URL || '';
      const url = `${apiBaseUrl}/api/v1/prometheus/query?base_url=${encodeURIComponent(baseUrl)}&query=${encodeURIComponent(query)}`;
      
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const data = await resp.json() as PromResult;
      
      // Format de réponse Prometheus: { status: "success", data: { result: [{ value: [timestamp, "value"] }] } }
      if (data.status === "success" && data.data?.result?.[0]?.value?.[1]) {
        const v = parseFloat(data.data.result[0].value[1]);
        return isFinite(v) ? v : null;
      }
      
      // Gérer les erreurs Prometheus
      if (data.status === "error" && data.error) {
        console.error('Prometheus query error:', data.error);
        return null;
      }
      
      return null;
    } catch (e) {
      console.error('Error running Prometheus query:', e);
      return null;
    }
  };

  const refresh = async () => {
    if (!baseUrl) {
      warning('Information', 'Configurez Prometheus dans Paramètres > Configuration Prometheus');
      return;
    }
    
    setLoading(true);
    try {
      const [c, m, d] = await Promise.all([runQuery(q.cpu), runQuery(q.mem), runQuery(q.disk)]);
      setCpu(c);
      setMem(m);
      setDisk(d);
      setLastUpdate(new Date());
      
      if (c === null && m === null && d === null) {
        warning('Information', 'Aucune métrique reçue. Vérifiez votre Prometheus et les exporters (node_exporter).');
      } else {
        success('Succès', 'Métriques Prometheus mises à jour');
      }
    } catch (e) {
      error('Erreur', 'Impossible de récupérer les métriques Prometheus');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUrl = () => {
    if (!baseUrl.trim()) {
      warning('Information', 'Veuillez saisir une URL Prometheus');
      return;
    }
    localStorage.setItem('prometheusConfig', JSON.stringify({ url: baseUrl.trim() }));
    success('Succès', 'URL Prometheus sauvegardée');
    refresh();
  };

  useEffect(() => {
    // Auto-refresh initial
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

  const Stat = ({ title, value, icon: Icon }: { title: string; value: number | null; icon: any }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {value !== null ? `${value.toFixed(1)}%` : '—'}
        </div>
        <div className="mt-2 w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              (value ?? 0) > 80 ? 'bg-red-500' : (value ?? 0) > 60 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(value ?? 0, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {t('monitoring.title') || 'Monitoring'}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {t('monitoring.subtitle') || 'Métriques Prometheus'}
          </p>
          {lastUpdate && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t('monitoring.last_update') || 'Dernière mise à jour'}: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input 
            value={baseUrl} 
            onChange={(e) => setBaseUrl(e.target.value)} 
            placeholder="http://prometheus.local:9090"
            className="min-w-[200px]"
          />
          <Button onClick={handleSaveUrl} variant="outline" disabled={loading}>
            {t('monitoring.save') || 'Sauvegarder'}
          </Button>
          <Button onClick={refresh} disabled={loading || !baseUrl}>
            {loading ? (
              <Loader size="sm" variant="spinner" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {loading ? (t('monitoring.loading') || 'Chargement...') : (t('monitoring.refresh') || 'Actualiser')}
          </Button>
        </div>
      </div>

      {!baseUrl ? (
        <Card>
          <CardContent className="text-center py-12">
            <Activity className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              {t('monitoring.no_config') || 'Configuration Prometheus requise'}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              {t('monitoring.no_config_message') || 'Veuillez configurer l\'URL Prometheus ci-dessus ou dans les Paramètres.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Stat title={t('monitoring.cpu') || 'CPU cluster'} value={cpu} icon={Cpu} />
          <Stat title={t('monitoring.memory') || 'Mémoire cluster'} value={mem} icon={MemoryStick} />
          <Stat title={t('monitoring.disk') || 'Disque (root)'} value={disk} icon={HardDrive} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>{t('monitoring.notes') || 'Notes'}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-400 space-y-2">
            <li>{t('monitoring.note1') || 'Renseignez l\'URL Prometheus ci-dessus ou dans Paramètres > Configuration Prometheus.'}</li>
            <li>{t('monitoring.note2') || 'Les métriques nécessitent node_exporter installé et configuré sur vos nœuds.'}</li>
            <li>{t('monitoring.note3') || 'Les requêtes utilisent l\'endpoint /api/v1/query de Prometheus via le backend.'}</li>
            <li>{t('monitoring.note4') || 'Les métriques sont mises à jour manuellement via le bouton "Actualiser".'}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
