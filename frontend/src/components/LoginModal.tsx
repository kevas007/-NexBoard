import { useState } from 'react';
import { Lock, Eye, EyeOff, User, Users } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useAuth, LoginRequest, LoginResponse } from '@/utils/auth';
import { useToast } from './ui/Toast';
import { apiPost } from '@/utils/api';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [loginData, setLoginData] = useState<LoginRequest>({
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState<'form' | 'legacy'>('form');
  const [legacyToken, setLegacyToken] = useState('');
  const { login } = useAuth();
  const { success, error } = useToast();

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loginData.username.trim() || !loginData.password.trim()) {
      error('Erreur', 'Veuillez saisir votre nom d\'utilisateur et mot de passe');
      return;
    }

    setLoading(true);

    try {
      const response = await apiPost<LoginResponse>('/api/auth/login', loginData);
      login(response.token, response.user);
      success('Connexion réussie', `Bienvenue ${response.user.username}!`);
      resetForm();
      onClose();
    } catch (err: any) {
      error('Erreur d\'authentification', err.message || 'Nom d\'utilisateur ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  const handleLegacySubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!legacyToken.trim()) {
      error('Erreur', 'Veuillez saisir un token d\'authentification');
      return;
    }

    setLoading(true);

    try {
      // Tester le token en faisant une requête à une route protégée
      const response = await fetch('/api/v1/apps', {
        headers: {
          'Authorization': `Bearer ${legacyToken}`,
        },
      });

      if (response.ok) {
        // Créer un utilisateur fictif pour le mode legacy
        const legacyUser = {
          id: 1,
          username: 'legacy-admin',
          email: 'admin@legacy.local',
          role: 'admin' as const,
          active: true,
          created_at: new Date().toISOString(),
        };
        login(legacyToken, legacyUser);
        success('Connexion réussie', 'Vous êtes maintenant authentifié (mode legacy)');
        resetForm();
        onClose();
      } else if (response.status === 401) {
        error('Erreur d\'authentification', 'Token invalide');
      } else {
        error('Erreur', 'Impossible de vérifier le token');
      }
    } catch (err) {
      error('Erreur réseau', 'Impossible de se connecter au serveur');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setLoginData({ username: '', password: '' });
    setLegacyToken('');
    setShowPassword(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Authentification" size="md">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-primary-900">
            <Lock className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Connexion à ProxmoxDash
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Choisissez votre mode de connexion
          </p>
        </div>

        {/* Mode Selection */}
        <div className="flex space-x-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setLoginMode('form')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-md transition-colors ${
              loginMode === 'form'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <User className="h-4 w-4" />
            <span>Utilisateur</span>
          </button>
          <button
            type="button"
            onClick={() => setLoginMode('legacy')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-md transition-colors ${
              loginMode === 'legacy'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Lock className="h-4 w-4" />
            <span>Token</span>
          </button>
        </div>

        {/* Form Content */}
        {loginMode === 'form' ? (
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <Input
              label="Nom d'utilisateur"
              value={loginData.username}
              onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
              placeholder="Saisissez votre nom d'utilisateur"
              required
            />

            <div className="relative">
              <Input
                label="Mot de passe"
                type={showPassword ? 'text' : 'password'}
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                placeholder="Saisissez votre mot de passe"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Demo Accounts */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
              <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-3 flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Comptes de démonstration
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">admin</span>
                    <Badge variant="error" size="sm" className="ml-2">Admin</Badge>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setLoginData({ username: 'admin', password: '' })}
                  >
                    Utiliser
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">demo</span>
                    <Badge variant="info" size="sm" className="ml-2">User</Badge>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setLoginData({ username: 'demo', password: '' })}
                  >
                    Utiliser
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">viewer</span>
                    <Badge variant="default" size="sm" className="ml-2">Viewer</Badge>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setLoginData({ username: 'viewer', password: '' })}
                  >
                    Utiliser
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={loading || !loginData.username.trim() || !loginData.password.trim()}
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleLegacySubmit} className="space-y-4">
            <div className="relative">
              <Input
                label="Token d'authentification"
                type={showPassword ? 'text' : 'password'}
                value={legacyToken}
                onChange={(e) => setLegacyToken(e.target.value)}
                placeholder="Saisissez votre token..."
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
              <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">
                Mode développement
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                Token par défaut : <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">[CONFIGURÉ DANS LES VARIABLES D'ENVIRONNEMENT]</code>
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLegacyToken('')}
                className="w-full"
              >
                Utiliser le token de développement
              </Button>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={loading || !legacyToken.trim()}
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
