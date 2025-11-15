import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { ToastContainer, useToast } from './components/ui/Toast';
import { Overview } from './pages/Overview';
import { Apps } from './pages/Apps';
import { Settings } from './pages/Settings';
import { UsersPage } from './pages/Users';
import { TasksLogs } from './pages/TasksLogs';
import { Nodes } from './pages/Nodes';
import { VMs } from './pages/VMs';
import { LXC } from './pages/LXC';
import { Docker } from './pages/Docker';
import { Databases } from './pages/Databases';
import { Storage } from './pages/Storage';
import { NetworkPage } from './pages/Network';
import { Backups } from './pages/Backups';
import { Monitoring } from './pages/Monitoring';
import { useSSE } from './hooks/useSSE';
import { useAuth } from './utils/auth';
import { apiGet, apiPut, Alert } from './utils/api';
import { seedProxmoxData } from './utils/frontendSeeders';
import { TranslationProvider } from './hooks/useTranslation';

function App() {
  // Charger les seeders frontend uniquement en mode dev
  useEffect(() => {
    // Vérifier si on est en mode développement
    const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
    if (isDev) {
      seedProxmoxData();
    } else {
      console.log('🚀 Mode production: aucune donnée de test ne sera chargée');
    }
  }, []);
  const [currentSection, setCurrentSection] = useState('overview');
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const { toasts, removeToast, warning, error, info } = useToast();
  const { isAuthenticated } = useAuth();

  // Configuration SSE
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
  const sseUrl = `${apiUrl}/api/v1/alerts/stream`;

  // Hook SSE pour les notifications temps réel (seulement si authentifié)
  useSSE(isAuthenticated ? sseUrl : '', {
    onAlert: (alert: Alert) => {
      // Ajouter l'alerte à la liste
      setAlerts(prev => [alert, ...(prev || []).slice(0, 19)]); // Garder seulement les 20 dernières

      // Afficher un toast selon la sévérité
      const message = `${alert.source}: ${alert.message}`;
      switch (alert.severity) {
        case 'critical':
          error(alert.title, message);
          break;
        case 'warning':
          warning(alert.title, message);
          break;
        case 'info':
          info(alert.title, message);
          break;
        default:
          info(alert.title, message);
      }
    },
    onAck: (data: { alert_id: number }) => {
      // Marquer l'alerte comme acquittée
      setAlerts(prev =>
        (prev || []).map(alert =>
          alert.id === data.alert_id
            ? { ...alert, acknowledged: true }
            : alert
        )
      );
    },
    onConnected: () => {
      // Connexion SSE établie - pas de notification
    },
    onError: () => {
      // Erreur SSE - pas de notification
    },
  });

  // Charger les alertes au démarrage et périodiquement
  useEffect(() => {
    const loadAlerts = async () => {
      try {
        const alertsData = await apiGet<Alert[]>('/api/v1/alerts?limit=20');
        setAlerts(alertsData || []);
      } catch (err) {
        console.error('Failed to load alerts:', err);
        // En cas d'erreur, initialiser avec un tableau vide
        setAlerts([]);
      }
    };

    // Charger immédiatement
    loadAlerts();

    // Rafraîchir toutes les 30 secondes (pour les utilisateurs non authentifiés ou si SSE échoue)
    const interval = setInterval(loadAlerts, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Écouter les événements de navigation depuis Overview
  useEffect(() => {
    const handleNavigate = (e: CustomEvent) => {
      setCurrentSection(e.detail);
    };

    window.addEventListener('navigate', handleNavigate as EventListener);
    return () => window.removeEventListener('navigate', handleNavigate as EventListener);
  }, []);

  // Gestion du thème
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  // Calculer le nombre d'alertes non acquittées
  const unacknowledgedCount = (alerts || []).filter(alert => !alert.acknowledged).length;

  // Fonction pour marquer toutes les notifications comme lues
  const handleAcknowledgeAll = async () => {
    try {
      const result = await apiPut<{ success: boolean; message: string }>('/api/v1/alerts/acknowledge-all');
      if (result && result.success) {
        // Mettre à jour l'état local
        setAlerts(prev => (prev || []).map(alert => ({ ...alert, acknowledged: true })));
        info('Notifications', 'Toutes les notifications ont été marquées comme lues');
        
        // Recharger les alertes pour s'assurer que le compteur est à jour
        try {
          const alertsData = await apiGet<Alert[]>('/api/v1/alerts?limit=20');
          setAlerts(alertsData || []);
        } catch (reloadErr) {
          console.error('Failed to reload alerts after acknowledge:', reloadErr);
        }
      } else {
        throw new Error('Réponse invalide du serveur');
      }
    } catch (err: any) {
      console.error('Failed to acknowledge all alerts:', err);
      const errorMessage = err?.status === 401 
        ? 'Authentification requise pour marquer les notifications comme lues'
        : err?.message || 'Impossible de marquer les notifications comme lues';
      error('Erreur', errorMessage);
    }
  };

  // Rendu des sections
  const renderSection = () => {
    switch (currentSection) {
      case 'overview':
        return <Overview />;
      case 'apps':
        return <Apps />;
      case 'users':
        return <UsersPage />;
      case 'settings':
        return <Settings />;
      case 'nodes':
        return <Nodes />;
      case 'vms':
        return <VMs />;
      case 'lxc':
        return <LXC />;
      case 'docker':
        return <Docker />;
      case 'databases':
        return <Databases />;
      case 'storage':
        return <Storage />;
      case 'network':
        return <NetworkPage />;
      case 'backups':
        return <Backups />;
      case 'monitoring':
        return <Monitoring />;
      case 'tasks':
        return <TasksLogs />;
      default:
        return <Overview />;
    }
  };

  return (
    <TranslationProvider>
      <div className="min-h-screen">
        <Layout
          currentSection={currentSection}
          onSectionChange={setCurrentSection}
          alertCount={unacknowledgedCount}
          onToggleTheme={toggleTheme}
          isDark={isDark}
          onAcknowledgeAll={handleAcknowledgeAll}
        >
          {renderSection()}
        </Layout>

        {/* Container des toasts */}
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        {/* Indicateur de connexion SSE supprimé */}
      </div>
    </TranslationProvider>
  );
}

export default App;
