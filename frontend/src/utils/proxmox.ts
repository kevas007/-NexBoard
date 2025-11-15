/**
 * Utilitaires pour la gestion de la configuration Proxmox
 */

export interface ProxmoxConfig {
  url: string;
  token: string;
  node: string;
  username?: string;
  secret?: string;
  password?: string; // Mot de passe optionnel pour la console VNC (si différent du secret du token)
}

export interface ProxmoxConnectionStatus {
  status: 'idle' | 'testing' | 'success' | 'error';
  message: string;
  lastTest?: Date;
}

class ProxmoxConfigManager {
  private static instance: ProxmoxConfigManager;
  private config: ProxmoxConfig | null = null;
  private connectionStatus: ProxmoxConnectionStatus = {
    status: 'idle',
    message: ''
  };

  private constructor() {
    this.loadConfig();
  }

  public static getInstance(): ProxmoxConfigManager {
    if (!ProxmoxConfigManager.instance) {
      ProxmoxConfigManager.instance = new ProxmoxConfigManager();
    }
    return ProxmoxConfigManager.instance;
  }

  /**
   * Charge la configuration depuis le localStorage
   */
  private loadConfig(): void {
    try {
      const savedConfig = localStorage.getItem('proxmoxConfig');
      if (savedConfig) {
        this.config = JSON.parse(savedConfig);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la configuration Proxmox:', error);
    }
  }

  /**
   * Sauvegarde la configuration dans le localStorage
   */
  public saveConfig(config: ProxmoxConfig): void {
    try {
      this.config = config;
      localStorage.setItem('proxmoxConfig', JSON.stringify(config));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la configuration Proxmox:', error);
      throw error;
    }
  }

  /**
   * Récupère la configuration actuelle
   */
  public getConfig(): ProxmoxConfig | null {
    return this.config;
  }

  /**
   * Vérifie si la configuration est complète
   */
  public isConfigComplete(): boolean {
    return !!(this.config?.url && this.config?.token && this.config?.node);
  }

  /**
   * Valide la configuration
   */
  public validateConfig(config: ProxmoxConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.url) {
      errors.push('L\'URL Proxmox est requise');
    } else {
      try {
        new URL(config.url);
      } catch {
        errors.push('L\'URL Proxmox n\'est pas valide');
      }
    }

    if (!config.token) {
      errors.push('Le token API est requis');
    } else if (!config.token.startsWith('PVEAPIToken=')) {
      errors.push('Le token API doit commencer par "PVEAPIToken="');
    }

    if (!config.node) {
      errors.push('Le nœud par défaut est requis');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Teste la connexion à Proxmox
   */
  public async testConnection(config?: ProxmoxConfig): Promise<ProxmoxConnectionStatus> {
    const configToTest = config || this.config;

    if (!configToTest) {
      this.connectionStatus = {
        status: 'error',
        message: 'Aucune configuration Proxmox trouvée'
      };
      return this.connectionStatus;
    }

    this.connectionStatus = {
      status: 'testing',
      message: 'Test de connexion en cours...'
    };

    try {
      // Importer apiPost dynamiquement pour éviter les dépendances circulaires
      const { apiPost } = await import('./api');

      // Extraire username et secret depuis le token si nécessaire
      let username = configToTest.username || '';
      let secret = configToTest.secret || '';

      // Si le token est fourni mais pas username/secret, extraire depuis le token
      if (configToTest.token && (!username || !secret)) {
        if (configToTest.token.startsWith('PVEAPIToken=')) {
          const tokenPart = configToTest.token.replace('PVEAPIToken=', '');
          // Format peut être: username!tokenname=secret ou username=secret
          if (tokenPart.includes('!') && tokenPart.includes('=')) {
            // Format: username!tokenname=secret
            const equalIndex = tokenPart.lastIndexOf('=');
            if (equalIndex > 0) {
              username = tokenPart.substring(0, equalIndex); // username!tokenname
              secret = tokenPart.substring(equalIndex + 1); // secret
            }
          } else if (tokenPart.includes('=')) {
            // Format: username=secret
            const parts = tokenPart.split('=');
            if (parts.length >= 2) {
              username = parts[0];
              secret = parts.slice(1).join('=');
            }
          }
        }
      }

      // Si toujours pas de username/secret, utiliser les valeurs par défaut
      if (!username) username = configToTest.username || '';
      if (!secret) secret = configToTest.secret || '';

      // Tester la connexion en appelant l'endpoint fetch-data du backend
      // Le backend va tester la connexion en récupérant les nœuds
      const result = await apiPost<{
        success: boolean;
        message?: string;
        nodes?: any[];
        error?: string;
      }>('/api/v1/proxmox/fetch-data', {
        url: configToTest.url,
        username: username,
        secret: secret,
        node: configToTest.node || 'pve'
      });

      if (result.success) {
        this.connectionStatus = {
          status: 'success',
          message: 'Connexion à Proxmox réussie !',
          lastTest: new Date()
        };
      } else {
        this.connectionStatus = {
          status: 'error',
          message: result.message || result.error || 'Impossible de se connecter à Proxmox',
          lastTest: new Date()
        };
      }
    } catch (error: any) {
      // Gérer les erreurs d'API
      let errorMessage = 'Erreur lors du test de connexion';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.error) {
        errorMessage = error.error;
      }

      // Messages d'erreur plus explicites
      if (errorMessage.includes('401') || errorMessage.includes('authentication')) {
        errorMessage = 'Erreur d\'authentification : Vérifiez vos credentials (utilisateur et secret)';
      } else if (errorMessage.includes('no such host') || errorMessage.includes('lookup') || errorMessage.includes('ECONNREFUSED')) {
        errorMessage = 'Impossible de se connecter au serveur Proxmox. Vérifiez l\'URL et que le serveur est accessible.';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'Timeout lors de la connexion. Le serveur Proxmox ne répond pas.';
      }

      this.connectionStatus = {
        status: 'error',
        message: errorMessage,
        lastTest: new Date()
      };
    }

    return this.connectionStatus;
  }

  /**
   * Récupère le statut de connexion actuel
   */
  public getConnectionStatus(): ProxmoxConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Réinitialise la configuration
   */
  public resetConfig(): void {
    this.config = null;
    this.connectionStatus = {
      status: 'idle',
      message: ''
    };
    localStorage.removeItem('proxmoxConfig');
  }

  /**
   * Génère une URL d'API Proxmox
   */
  public getApiUrl(endpoint: string = ''): string | null {
    if (!this.config?.url) return null;

    const baseUrl = this.config.url.replace(/\/$/, '');
    return `${baseUrl}/api2/json${endpoint}`;
  }

  /**
   * Génère les headers d'authentification
   */
  public getAuthHeaders(): Record<string, string> | null {
    if (!this.config?.token) return null;

    return {
      'Authorization': this.config.token
    };
  }
}

// Export de l'instance singleton
export const proxmoxConfigManager = ProxmoxConfigManager.getInstance();

// Export des types et utilitaires
export { ProxmoxConfigManager };
