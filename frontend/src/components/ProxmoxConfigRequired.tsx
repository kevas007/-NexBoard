import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Server, Settings } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { storage } from '@/utils/storage';

interface ProxmoxConfigRequiredProps {
  title?: string;
  message?: string;
}

export function ProxmoxConfigRequired({ 
  title, 
  message 
}: ProxmoxConfigRequiredProps) {
  const { t } = useTranslation();
  const proxmoxConfig = storage.getProxmoxConfig();

  // Vérifier si on est en production
  const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';

  // En production, ne rien afficher si Proxmox n'est pas configuré
  // En dev, on peut afficher un message
  if (isProduction && !proxmoxConfig) {
    return null;
  }

  // Si Proxmox est configuré, ne rien afficher
  if (proxmoxConfig) {
    return null;
  }

  const handleGoToSettings = () => {
    window.location.hash = '#/settings';
  };

  return (
    <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <Server className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
              {title || t('proxmox.config_required_title') || 'Configuration Proxmox requise'}
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
              {message || t('proxmox.config_required_message') || 
                'Pour afficher les données Proxmox, veuillez d\'abord configurer votre connexion dans les Paramètres.'}
            </p>
            <Button
              onClick={handleGoToSettings}
              variant="primary"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Settings className="h-4 w-4 mr-2" />
              {t('proxmox.go_to_settings') || 'Aller aux Paramètres'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

