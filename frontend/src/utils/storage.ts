/**
 * Utilitaires pour la gestion optimisée du localStorage
 * Ne stocke que les données essentielles (token, utilisateur)
 * Les autres données sont récupérées à la demande depuis l'API
 */

import { apiPost } from './api';

export interface UserData {
  username: string;
  token: string;
  isAuthenticated: boolean;
}

export interface ProxmoxConfig {
  url: string;
  username: string;
  secret: string;
  password?: string; // Mot de passe optionnel pour la console VNC (si différent du secret du token)
  node: string;
}

/**
 * Stocke uniquement les données essentielles dans localStorage
 */
export const storage = {
  // Données utilisateur (essentielles)
  setUserData: (userData: UserData) => {
    localStorage.setItem('userData', JSON.stringify(userData));
  },

  getUserData: (): UserData | null => {
    const data = localStorage.getItem('userData');
    return data ? JSON.parse(data) : null;
  },

  clearUserData: () => {
    localStorage.removeItem('userData');
  },

  // Configuration Proxmox (essentielle)
  setProxmoxConfig: (config: ProxmoxConfig) => {
    localStorage.setItem('proxmoxConfig', JSON.stringify(config));
  },

  getProxmoxConfig: (): ProxmoxConfig | null => {
    const data = localStorage.getItem('proxmoxConfig');
    return data ? JSON.parse(data) : null;
  },

  clearProxmoxConfig: () => {
    localStorage.removeItem('proxmoxConfig');
  },

  // Données Proxmox (temporaires, récupérées à la demande)
  setProxmoxData: (data: any) => {
    // Stockage temporaire avec timestamp
    const dataWithTimestamp = {
      ...data,
      timestamp: Date.now(),
      expires: Date.now() + (5 * 60 * 1000) // 5 minutes
    };
    localStorage.setItem('proxmoxData', JSON.stringify(dataWithTimestamp));
  },

  getProxmoxData: () => {
    const data = localStorage.getItem('proxmoxData');
    if (!data) return null;

    const parsed = JSON.parse(data);

    // Vérifier si les données ont expiré
    if (Date.now() > parsed.expires) {
      localStorage.removeItem('proxmoxData');
      return null;
    }

    return parsed;
  },

  clearProxmoxData: () => {
    localStorage.removeItem('proxmoxData');
  },

  // Nettoyage complet
  clearAll: () => {
    localStorage.removeItem('userData');
    localStorage.removeItem('proxmoxConfig');
    localStorage.removeItem('proxmoxData');
    localStorage.removeItem('proxmoxNodes');
    localStorage.removeItem('proxmoxVMs');
    localStorage.removeItem('proxmoxLXC');
  },

  // Vérifier si les données Proxmox sont valides
  isProxmoxDataValid: (): boolean => {
    const data = storage.getProxmoxData();
    return data !== null && Date.now() <= data.expires;
  },

  // Obtenir les données Proxmox ou déclencher un rafraîchissement
  getProxmoxDataOrRefresh: async (): Promise<any> => {
    const data = storage.getProxmoxData();

    if (data && storage.isProxmoxDataValid()) {
      return data;
    }

    // Les données ont expiré ou n'existent pas, déclencher un rafraîchissement
    console.log('🔄 Données Proxmox expirées ou manquantes, rafraîchissement nécessaire');

    // Déclencher l'événement de rafraîchissement
    window.dispatchEvent(new CustomEvent('proxmoxDataRefreshNeeded'));

    return null;
  },

  // S'assurer que les données Proxmox sont chargées (appelé automatiquement par les pages)
  ensureProxmoxDataLoaded: async (): Promise<boolean> => {
    try {
      // Vérifier si la configuration Proxmox existe
      const config = storage.getProxmoxConfig();
      if (!config) {
        console.log('⚠️ Aucune configuration Proxmox trouvée');
        return false;
      }

      // Vérifier si les données sont déjà en cache et valides
      const cachedData = storage.getProxmoxData();
      if (cachedData && storage.isProxmoxDataValid()) {
        console.log('✅ Données Proxmox déjà en cache et valides');
        return true;
      }

      // Vérifier si les données individuelles existent dans localStorage
      const hasNodes = localStorage.getItem('proxmoxNodes');
      const hasVMs = localStorage.getItem('proxmoxVMs');
      const hasLXC = localStorage.getItem('proxmoxLXC');
      
      // Si toutes les données existent, on considère qu'elles sont valides
      if (hasNodes && hasVMs && hasLXC) {
        console.log('✅ Données Proxmox trouvées dans localStorage');
        return true;
      }

      // Les données ne sont pas en cache ou sont expirées, les charger
      console.log('🔄 Chargement automatique des données Proxmox...');
      
      const data = await apiPost<{
        success: boolean;
        message?: string;
        nodes?: any[];
        vms?: any[];
        lxc?: any[];
        storages?: any[];
        networks?: any[];
      }>('/api/v1/proxmox/fetch-data', config);

      if (data.success) {
        // Stocker les nouvelles données
        storage.setProxmoxData(data);

        // Stocker les données individuelles pour compatibilité
        if (data.nodes) {
          localStorage.setItem('proxmoxNodes', JSON.stringify(data.nodes));
        }
        if (data.vms) {
          localStorage.setItem('proxmoxVMs', JSON.stringify(data.vms));
        }
        if (data.lxc) {
          localStorage.setItem('proxmoxLXC', JSON.stringify(data.lxc));
        }
        if (data.storages) {
          localStorage.setItem('proxmoxStorages', JSON.stringify(data.storages));
        }
        if (data.networks) {
          localStorage.setItem('proxmoxNetworks', JSON.stringify(data.networks));
        }

        // Déclencher l'événement de mise à jour
        window.dispatchEvent(new CustomEvent('proxmoxDataUpdated', {
          detail: data
        }));

        console.log('✅ Données Proxmox chargées avec succès');
        return true;
      } else {
        console.error('❌ Erreur lors du chargement des données Proxmox:', data.message);
        return false;
      }
    } catch (error) {
      // Erreur silencieuse pour ne pas perturber l'utilisateur
      console.error('❌ Erreur lors du chargement automatique des données Proxmox:', error);
      return false;
    }
  }
};

/**
 * Hook pour gérer les données Proxmox avec cache intelligent
 */
export const useProxmoxData = () => {
  const getData = () => {
    return storage.getProxmoxData();
  };

  const refreshData = async () => {
    try {
      const config = storage.getProxmoxConfig();
      if (!config) {
        throw new Error('Configuration Proxmox manquante');
      }

      // Utiliser apiPost pour utiliser la bonne URL de l'API (API_BASE_URL)
      const data = await apiPost<{
        success: boolean;
        message?: string;
        nodes?: any[];
        vms?: any[];
        lxc?: any[];
        storages?: any[];
      }>('/api/v1/proxmox/fetch-data', config);

      // Stocker les nouvelles données
      storage.setProxmoxData(data);

      // Stocker les données individuelles pour compatibilité
      if (data.nodes) {
        localStorage.setItem('proxmoxNodes', JSON.stringify(data.nodes));
      }
      if (data.vms) {
        localStorage.setItem('proxmoxVMs', JSON.stringify(data.vms));
      }
      if (data.lxc) {
        localStorage.setItem('proxmoxLXC', JSON.stringify(data.lxc));
      }

      // Déclencher l'événement de mise à jour
      window.dispatchEvent(new CustomEvent('proxmoxDataUpdated', {
        detail: data
      }));

      return data;
    } catch (error) {
      console.error('❌ Erreur lors du rafraîchissement des données Proxmox:', error);
      throw error;
    }
  };

  return {
    getData,
    refreshData,
    isDataValid: storage.isProxmoxDataValid,
    clearData: storage.clearProxmoxData
  };
};
