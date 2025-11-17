import { authManager } from './auth';

// En production Docker, nginx proxy les requêtes /api vers le backend
// Donc on utilise une URL vide pour les URLs relatives
// En développement, Vite proxy aussi /api vers localhost:8080 (voir vite.config.ts)
// Si VITE_API_URL est défini, on l'utilise (priorité)
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status?: number;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(response.status, errorData.error || `HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }

  return response.text() as T;
}

export async function api<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Construire l'URL : si API_BASE_URL est vide, utiliser l'endpoint tel quel (proxy Vite)
  // Sinon, utiliser API_BASE_URL + endpoint
  const url = API_BASE_URL ? `${API_BASE_URL}${endpoint}` : endpoint;

  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...authManager.getAuthHeaders(),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    return await handleResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Améliorer les messages d'erreur pour les problèmes de connexion
    let errorMessage = `Erreur réseau: ${error instanceof Error ? error.message : 'Inconnue'}`;
    
    if (error instanceof TypeError && (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED'))) {
      // Détecter les erreurs de connexion refusée
      const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
      
      if (fullUrl.includes('localhost:5173') || fullUrl.includes('localhost:8080')) {
        errorMessage = `Impossible de se connecter au serveur backend. Vérifiez que:
- Le serveur backend est démarré sur le port 8080
- Le proxy Vite est correctement configuré (vite.config.ts)
- Aucun firewall ne bloque la connexion

URL tentée: ${fullUrl}`;
      } else {
        errorMessage = `Impossible de se connecter au serveur. Vérifiez votre connexion réseau et que le serveur est accessible. URL tentée: ${fullUrl}`;
      }
    }
    
    throw new ApiError(0, errorMessage);
  }
}

// Helper functions pour les endpoints spécifiques
export const apiGet = <T>(endpoint: string) => api<T>(endpoint);

export const apiPost = <T>(endpoint: string, data?: any) =>
  api<T>(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });

export const apiPut = <T>(endpoint: string, data?: any) =>
  api<T>(endpoint, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });

export const apiDelete = (endpoint: string) =>
  api(endpoint, { method: 'DELETE' });

// Types pour l'API
export interface App {
  id: number;
  name: string;
  protocol: string;
  host: string;
  port: number;
  path: string;
  tag?: string;
  icon?: string;
  health_path: string;
  health_type: string;
  resource_type?: 'vm' | 'lxc' | 'docker';
  resource_id?: string;
  resource_node?: string;
  created_at: string;
}

export interface Alert {
  id: number;
  source: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  payload?: string;
  created_at: string;
  acknowledged: boolean;
}

export interface HealthStatus {
  app_id?: number;
  status: 'online' | 'offline' | 'unknown';
  latency?: number;
  last_check: string;
  status_code?: number;
  error?: string;
}

export interface CreateAppRequest {
  name: string;
  protocol: string;
  host: string;
  port: number;
  path: string;
  tag?: string;
  icon?: string;
  health_path: string;
  health_type: string;
  resource_type?: 'vm' | 'lxc' | 'docker';
  resource_id?: string;
  resource_node?: string;
}

export interface NotifyTestRequest {
  to: string;
}

export interface SubscribeRequest {
  channel: 'email' | 'webhook';
  endpoint: string;
}
