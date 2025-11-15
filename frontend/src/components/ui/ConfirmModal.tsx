import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { ButtonLoader } from './Loader';
import { cn } from '@/utils/cn';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  variant = 'warning',
  loading = false
}: ConfirmModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const variantStyles = {
    danger: {
      icon: 'text-red-600 dark:text-red-400',
      button: 'bg-red-600 hover:bg-red-700 text-white'
    },
    warning: {
      icon: 'text-amber-600 dark:text-amber-400',
      button: 'bg-amber-600 hover:bg-amber-700 text-white'
    },
    info: {
      icon: 'text-blue-600 dark:text-blue-400',
      button: 'bg-blue-600 hover:bg-blue-700 text-white'
    }
  };

  const variantIcons = {
    danger: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const styles = variantStyles[variant];
  const Icon = variantIcons[variant];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || 'Confirmation'} size="sm">
      <div className="flex items-start space-x-4">
        <Icon className={cn('h-6 w-6 flex-shrink-0 mt-1', styles.icon)} />
        <div className="flex-1">
          <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line">
            {message}
          </p>
          <div className="mt-6 flex justify-end space-x-3">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              {cancelText}
            </Button>
            <Button 
              variant={variant === 'danger' ? 'danger' : 'primary'} 
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <ButtonLoader size="sm" />
                  Chargement...
                </span>
              ) : (
                confirmText
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

