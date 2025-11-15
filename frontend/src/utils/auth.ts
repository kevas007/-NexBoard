// Gestion de l'authentification côté frontend

const AUTH_TOKEN_KEY = 'proxmox_dash_token';
const AUTH_USER_KEY = 'proxmox_dash_user';

// Types pour l'authentification
export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user' | 'viewer' | 'guest';
  active: boolean;
  last_login?: string;
  created_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  expires_at: string;
}

export class AuthManager {
  private static instance: AuthManager;
  private token: string | null = null;
  private user: User | null = null;

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  private loadFromStorage(): void {
    this.token = localStorage.getItem(AUTH_TOKEN_KEY);
    const userStr = localStorage.getItem(AUTH_USER_KEY);
    if (userStr) {
      try {
        this.user = JSON.parse(userStr);
      } catch (e) {
        this.user = null;
        localStorage.removeItem(AUTH_USER_KEY);
      }
    }
  }

  public setAuth(token: string, user: User): void {
    this.token = token;
    this.user = user;
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  }

  public getToken(): string | null {
    return this.token;
  }

  public getUser(): User | null {
    return this.user;
  }

  public clearAuth(): void {
    this.token = null;
    this.user = null;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  }

  public isAuthenticated(): boolean {
    return this.token !== null && this.token.length > 0;
  }

  public getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }
}

// Instance singleton
export const authManager = AuthManager.getInstance();

// Hook React pour l'authentification
import { useState, useEffect } from 'react';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(authManager.isAuthenticated());
  const [token, setToken] = useState(authManager.getToken());

  useEffect(() => {
    const checkAuth = () => {
      const currentToken = authManager.getToken();
      const currentAuth = authManager.isAuthenticated();

      if (currentToken !== token) {
        setToken(currentToken);
      }

      if (currentAuth !== isAuthenticated) {
        setIsAuthenticated(currentAuth);
      }
    };

    // Vérifier périodiquement
    const interval = setInterval(checkAuth, 1000);

    return () => clearInterval(interval);
  }, [token, isAuthenticated]);

  const login = (token: string, user: User) => {
    authManager.setAuth(token, user);
    setToken(token);
    setIsAuthenticated(true);
  };

  const logout = () => {
    authManager.clearAuth();
    setToken(null);
    setIsAuthenticated(false);
  };

  return {
    isAuthenticated,
    token,
    user: authManager.getUser(),
    login,
    logout,
    getAuthHeaders: () => authManager.getAuthHeaders(),
  };
}

// Fonctions utilitaires pour les permissions
export const hasPermission = (user: User | null, resource: string, action: string): boolean => {
  if (!user) return false;

  const permissions: Record<string, string[]> = {
    admin: ['*'],
    user: ['apps:read', 'apps:write', 'alerts:read', 'alerts:write', 'health:read', 'profile:read', 'profile:write'],
    viewer: ['apps:read', 'alerts:read', 'health:read', 'profile:read'],
    guest: ['health:read'],
  };

  const userPermissions = permissions[user.role] || [];

  // Admin a tous les droits
  if (userPermissions.includes('*')) return true;

  // Vérifier la permission spécifique
  return userPermissions.includes(`${resource}:${action}`);
};

export const hasRole = (user: User | null, minRole: string): boolean => {
  if (!user) return false;

  const roleHierarchy: Record<string, number> = {
    guest: 0,
    viewer: 1,
    user: 2,
    admin: 3,
  };

  const userLevel = roleHierarchy[user.role] || 0;
  const minLevel = roleHierarchy[minRole] || 0;

  return userLevel >= minLevel;
};
