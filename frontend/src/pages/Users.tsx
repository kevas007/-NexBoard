import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, Shield, Eye, EyeOff, UserCheck, UserX } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useAuth, User, hasPermission } from '@/utils/auth';
import { apiGet, apiPost, apiPut, apiDelete } from '@/utils/api';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Loader } from '@/components/ui/Loader';

interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'user' | 'viewer' | 'guest';
}

const roleLabels = {
  admin: { label: 'Administrateur', color: 'error' as const },
  user: { label: 'Utilisateur', color: 'info' as const },
  viewer: { label: 'Observateur', color: 'default' as const },
  guest: { label: 'Invité', color: 'warning' as const },
};

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<CreateUserRequest>({
    username: '',
    email: '',
    password: '',
    role: 'user',
  });

  const { user: currentUser } = useAuth();
  const { success, error } = useToast();
  
  // États pour les modales de confirmation
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

  // Vérifier les permissions
  const canManageUsers = hasPermission(currentUser, 'users', 'write');
  const canViewUsers = hasPermission(currentUser, 'users', 'read') || currentUser?.role === 'admin';

  useEffect(() => {
    if (canViewUsers) {
      loadUsers();
    }
  }, [canViewUsers]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await apiGet<User[]>('/api/auth/users');
      setUsers(data);
    } catch (err: any) {
      error('Erreur', 'Impossible de charger les utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.username.trim() || !formData.email.trim() || !formData.password.trim()) {
      error('Erreur', 'Tous les champs sont requis');
      return;
    }

    try {
      await apiPost<User>('/api/auth/users', formData);
      success('Succès', 'Utilisateur créé avec succès');
      setShowCreateModal(false);
      resetForm();
      loadUsers();
    } catch (err: any) {
      error('Erreur', err.message || 'Impossible de créer l\'utilisateur');
    }
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUser) return;

    try {
      const updateData: any = {
        username: formData.username,
        email: formData.email,
        role: formData.role,
      };

      if (formData.password.trim()) {
        updateData.password = formData.password;
      }

      await apiPut<User>(`/api/auth/users/${selectedUser.id}`, updateData);
      success('Succès', 'Utilisateur mis à jour avec succès');
      setShowEditModal(false);
      resetForm();
      loadUsers();
    } catch (err: any) {
      error('Erreur', err.message || 'Impossible de mettre à jour l\'utilisateur');
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await apiPut<User>(`/api/auth/users/${user.id}`, {
        active: !user.active,
      });
      success('Succès', `Utilisateur ${user.active ? 'désactivé' : 'activé'} avec succès`);
      loadUsers();
    } catch (err: any) {
      error('Erreur', err.message || 'Impossible de modifier le statut de l\'utilisateur');
    }
  };

  const handleDeleteUser = (user: User) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmer la suppression',
      message: `Êtes-vous sûr de vouloir supprimer l'utilisateur "${user.username}" ?`,
      variant: 'danger',
      onConfirm: async () => {
    try {
      await apiDelete(`/api/auth/users/${user.id}`);
      success('Succès', 'Utilisateur supprimé avec succès');
      loadUsers();
    } catch (err: any) {
      error('Erreur', err.message || 'Impossible de supprimer l\'utilisateur');
    }
      }
    });
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      role: 'user',
    });
    setSelectedUser(null);
    setShowPassword(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!canViewUsers) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
            Accès refusé
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Vous n'avez pas les permissions nécessaires pour voir cette page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Gestion des utilisateurs
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Gérez les comptes utilisateurs et leurs permissions
          </p>
        </div>
        {canManageUsers && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvel utilisateur
          </Button>
        )}
      </div>

      {/* Users List */}
      <Card>
        <div className="p-6">
          <div className="flex items-center mb-6">
            <Users className="h-5 w-5 text-slate-600 dark:text-slate-400 mr-2" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Utilisateurs ({users.length})
            </h2>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <Loader size="lg" variant="spinner" text="Chargement des utilisateurs..." />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                Aucun utilisateur
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Commencez par créer votre premier utilisateur.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                      Utilisateur
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                      Rôle
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                      Statut
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                      Dernière connexion
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                      Créé le
                    </th>
                    {canManageUsers && (
                      <th className="text-right py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {user.username}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            {user.email}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={roleLabels[user.role].color}>
                          {roleLabels[user.role].label}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          {user.active ? (
                            <UserCheck className="h-4 w-4 text-green-500 mr-2" />
                          ) : (
                            <UserX className="h-4 w-4 text-red-500 mr-2" />
                          )}
                          <span className={user.active ? 'text-green-600' : 'text-red-600'}>
                            {user.active ? 'Actif' : 'Inactif'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {user.last_login ? formatDate(user.last_login) : 'Jamais'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {formatDate(user.created_at)}
                      </td>
                      {canManageUsers && (
                        <td className="py-3 px-4">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditUser(user)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleActive(user)}
                              className={user.active ? 'text-red-600' : 'text-green-600'}
                            >
                              {user.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                            </Button>
                            {currentUser?.id !== user.id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteUser(user)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title="Créer un utilisateur"
        size="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <Input
            label="Nom d'utilisateur"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            placeholder="Saisissez le nom d'utilisateur"
            required
          />

          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="Saisissez l'email"
            required
          />

          <div className="relative">
            <Input
              label="Mot de passe"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Saisissez le mot de passe"
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

          <Select
            label="Rôle"
            value={formData.role}
            onChange={(value) => setFormData({ ...formData, role: value as any })}
            options={[
              { value: 'admin', label: 'Administrateur' },
              { value: 'user', label: 'Utilisateur' },
              { value: 'viewer', label: 'Observateur' },
              { value: 'guest', label: 'Invité' },
            ]}
          />

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
            >
              Annuler
            </Button>
            <Button type="submit">
              Créer l'utilisateur
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          resetForm();
        }}
        title="Modifier l'utilisateur"
        size="md"
      >
        <form onSubmit={handleUpdateUser} className="space-y-4">
          <Input
            label="Nom d'utilisateur"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            placeholder="Saisissez le nom d'utilisateur"
            required
          />

          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="Saisissez l'email"
            required
          />

          <div className="relative">
            <Input
              label="Nouveau mot de passe (optionnel)"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Laissez vide pour conserver l'actuel"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <Select
            label="Rôle"
            value={formData.role}
            onChange={(value) => setFormData({ ...formData, role: value as any })}
            options={[
              { value: 'admin', label: 'Administrateur' },
              { value: 'user', label: 'Utilisateur' },
              { value: 'viewer', label: 'Observateur' },
              { value: 'guest', label: 'Invité' },
            ]}
            disabled={currentUser?.id === selectedUser?.id && currentUser?.role !== 'admin'}
          />

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowEditModal(false);
                resetForm();
              }}
            >
              Annuler
            </Button>
            <Button type="submit">
              Mettre à jour
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
