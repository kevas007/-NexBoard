import { useState, useEffect } from 'react';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  Pause,
  RotateCcw,
  Download,
  Calendar,
  User,
  Server
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { exportToCSV } from '@/utils/export';
import { apiPost } from '@/utils/api';
import { storage } from '@/utils/storage';

interface Task {
  id: number;
  name: string;
  type: 'backup' | 'migration' | 'maintenance' | 'deployment';
  status: 'running' | 'completed' | 'failed' | 'pending';
  progress: number;
  started_at: string;
  completed_at?: string;
  duration?: number;
  user: string;
  node: string;
  details?: string;
}

interface LogEntry {
  id: number;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  source: string;
  message: string;
  task_id?: number;
}

export function TasksLogs() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'logs'>('tasks');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const { success } = useToast();

  // Charger les données TasksLogs depuis Proxmox
  const loadTasksLogsData = async () => {
    try {
      setLoading(true);
      
      // Essayer de charger les données Proxmox réelles
      const savedConfig = localStorage.getItem('proxmoxConfig');
      if (!savedConfig) {
        console.log('⚠️ Aucune configuration Proxmox trouvée');
        setTasks([]);
        setLogs([]);
        setLoading(false);
        return;
      }

      const config = JSON.parse(savedConfig);

      // Appeler l'API backend pour récupérer les tâches
      const data = await apiPost<{
        success: boolean;
        message?: string;
        tasks?: any[];
      }>('/api/v1/proxmox/fetch-tasks', {
        url: config.url,
        username: config.username,
        secret: config.secret
      });

      if (data.success && data.tasks) {
        // Convertir les données Proxmox vers le format Task
        const convertedTasks: Task[] = data.tasks.map((task: any, index: number) => ({
          id: index + 1,
          name: task.name || task.id || 'unknown',
          type: (task.type === 'vzdump' ? 'backup' : task.type === 'migrate' ? 'migration' : 'maintenance') as Task['type'],
          status: (task.status === 'running' ? 'running' : task.status === 'completed' ? 'completed' : task.status === 'failed' ? 'failed' : 'pending') as Task['status'],
          progress: task.progress || 0,
          started_at: task.started_at || task.created_at || new Date().toISOString(),
          completed_at: task.completed_at,
          duration: task.duration,
          user: task.user || 'admin',
          node: task.node || 'unknown',
          details: task.details || ''
        }));

        setTasks(convertedTasks);
        console.log('✅ Tâches chargées depuis Proxmox:', convertedTasks.length);
        
        // Les logs ne sont pas disponibles directement depuis l'API Proxmox
        // On peut créer des logs basés sur les tâches
        const convertedLogs: LogEntry[] = convertedTasks.map((task, index) => ({
          id: index + 1,
          timestamp: task.started_at,
          level: task.status === 'completed' ? 'info' : task.status === 'failed' ? 'error' : 'warning' as LogEntry['level'],
          source: task.type,
          message: task.details || `${task.name} - ${task.status}`,
          task_id: task.id
        }));
        
        setLogs(convertedLogs);
      } else {
        console.warn('⚠️ Aucune donnée task trouvée ou erreur:', data.message);
        setTasks([]);
        setLogs([]);
      }
    } catch (err) {
      console.error('❌ Erreur lors du chargement des données TasksLogs:', err);
      setTasks([]);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Charger automatiquement les données Proxmox si la configuration existe
    const loadDataOnMount = async () => {
      await storage.ensureProxmoxDataLoaded();
      // Charger les tâches après avoir chargé les données
      await loadTasksLogsData();
    };
    
    loadDataOnMount();
  }, []);

  // Rafraîchissement automatique toutes les 30 secondes
  useEffect(() => {
    const interval = setInterval(async () => {
      await storage.ensureProxmoxDataLoaded();
      await loadTasksLogsData();
    }, 30000); // 30 secondes

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'running':
        return <Play className="h-4 w-4 text-blue-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'success',
      running: 'info',
      failed: 'error',
      pending: 'warning'
    } as const;

    const labels = {
      completed: 'Terminé',
      running: 'En cours',
      failed: 'Échoué',
      pending: 'En attente'
    };

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const getLevelBadge = (level: string) => {
    const variants = {
      info: 'info',
      warning: 'warning',
      error: 'error',
      debug: 'default'
    } as const;

    return (
      <Badge variant={variants[level as keyof typeof variants]} size="sm">
        {level.toUpperCase()}
      </Badge>
    );
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      backup: 'Sauvegarde',
      migration: 'Migration',
      maintenance: 'Maintenance',
      deployment: 'Déploiement'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const formatDuration = (minutes: number) => {
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

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.details?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.source.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600 dark:text-slate-400">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Tâches & Logs
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Suivi des tâches système et consultation des logs
        </p>
      </div>

      {/* Onglets */}
      <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'tasks'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          Tâches ({tasks.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'logs'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          Logs ({logs.length})
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
        {activeTab === 'tasks' ? (
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'all', label: 'Tous les statuts' },
              { value: 'running', label: 'En cours' },
              { value: 'completed', label: 'Terminé' },
              { value: 'failed', label: 'Échoué' },
              { value: 'pending', label: 'En attente' }
            ]}
          />
        ) : (
          <Select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            options={[
              { value: 'all', label: 'Tous les niveaux' },
              { value: 'error', label: 'Erreur' },
              { value: 'warning', label: 'Avertissement' },
              { value: 'info', label: 'Information' },
              { value: 'debug', label: 'Debug' }
            ]}
          />
        )}
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => {
            if (activeTab === 'tasks') {
              exportToCSV(filteredTasks, `taches-${new Date().toISOString().split('T')[0]}`, {
                id: 'ID',
                name: 'Nom',
                type: 'Type',
                status: 'Statut',
                progress: 'Progression (%)',
                started_at: 'Démarré le',
                completed_at: 'Terminé le',
                duration: 'Durée (min)',
                user: 'Utilisateur',
                node: 'Nœud',
                details: 'Détails'
              });
              success('Export réussi', 'Les tâches ont été exportées en CSV');
            } else {
              exportToCSV(filteredLogs, `logs-${new Date().toISOString().split('T')[0]}`, {
                id: 'ID',
                timestamp: 'Horodatage',
                level: 'Niveau',
                source: 'Source',
                message: 'Message',
                task_id: 'ID Tâche'
              });
              success('Export réussi', 'Les logs ont été exportés en CSV');
            }
          }}
        >
          <Download className="h-4 w-4 mr-2" />
          Exporter
        </Button>
      </div>

      {/* Contenu des onglets */}
      {activeTab === 'tasks' ? (
        <div className="space-y-4">
          {filteredTasks.map((task) => (
            <Card key={task.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      {getStatusIcon(task.status)}
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {task.name}
                      </h3>
                      {getStatusBadge(task.status)}
                      <Badge variant="default" size="sm">
                        {getTypeLabel(task.type)}
                      </Badge>
                    </div>

                    <p className="text-slate-600 dark:text-slate-400 mb-4">
                      {task.details}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-600 dark:text-slate-400">
                          {task.user}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Server className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-600 dark:text-slate-400">
                          {task.node}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-600 dark:text-slate-400">
                          {formatDate(task.started_at)}
                        </span>
                      </div>
                      {task.duration && (
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-slate-400" />
                          <span className="text-slate-600 dark:text-slate-400">
                            {formatDuration(task.duration)}
                          </span>
                        </div>
                      )}
                    </div>

                    {task.status === 'running' && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-slate-600 dark:text-slate-400">Progression</span>
                          <span className="text-slate-600 dark:text-slate-400">{task.progress}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-2 ml-4">
                    {task.status === 'running' && (
                      <Button variant="outline" size="sm">
                        <Pause className="h-4 w-4" />
                      </Button>
                    )}
                    {task.status === 'failed' && (
                      <Button variant="outline" size="sm">
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="outline" size="sm">
                      <FileText className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log) => (
            <Card key={log.id}>
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {getLevelBadge(log.level)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {formatDate(log.timestamp)}
                      </span>
                      <Badge variant="default" size="sm">
                        {log.source}
                      </Badge>
                      {log.task_id && (
                      <Badge variant="default" size="sm">
                        Tâche #{log.task_id}
                      </Badge>
                      )}
                    </div>
                    <p className="text-slate-900 dark:text-slate-100 font-mono text-sm">
                      {log.message}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredTasks.length === 0 && activeTab === 'tasks' && (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              Aucune tâche trouvée
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Aucune tâche ne correspond aux critères de recherche.
            </p>
          </CardContent>
        </Card>
      )}

      {filteredLogs.length === 0 && activeTab === 'logs' && (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              Aucun log trouvé
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Aucun log ne correspond aux critères de recherche.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
