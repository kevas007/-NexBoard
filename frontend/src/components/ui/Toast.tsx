import { useEffect, useState } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

interface ToastProps extends Toast {
  onRemove: (id: string) => void;
}

const toastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const toastStyles = {
  success: 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900 dark:text-green-200',
  error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900 dark:text-red-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900 dark:text-amber-200',
  info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900 dark:text-blue-200',
};

export function ToastItem({ id, type, title, message, duration = 5000, onRemove }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const Icon = toastIcons[type];

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onRemove(id), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onRemove]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onRemove(id), 300);
  };

  return (
    <div
      className={cn(
        'flex items-start space-x-3 rounded-2xl border p-4 shadow-lg transition-all duration-300',
        toastStyles[type],
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-medium">{title}</p>
        {message && (
          <p className="mt-1 text-sm opacity-90">{message}</p>
        )}
      </div>
      <button
        onClick={handleClose}
        className="flex-shrink-0 rounded-lg p-1 hover:bg-black hover:bg-opacity-10 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          {...toast}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

// Système de toasts global (singleton)
let globalToasts: Toast[] = [];
let globalListeners: Array<(toasts: Toast[]) => void> = [];

const notifyListeners = () => {
  globalListeners.forEach(listener => listener([...globalToasts]));
};

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
  globalToasts = [...globalToasts, { ...toast, id }];
  notifyListeners();
  };

  const removeToast = (id: string) => {
  globalToasts = globalToasts.filter((toast) => toast.id !== id);
  notifyListeners();
};

// Hook pour gérer les toasts (utilise le système global)
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>(globalToasts);

  useEffect(() => {
    const listener = (newToasts: Toast[]) => {
      setToasts(newToasts);
    };
    globalListeners.push(listener);
    return () => {
      globalListeners = globalListeners.filter(l => l !== listener);
  };
  }, []);

  const success = (title: string, message?: string) => {
    addToast({ type: 'success', title, message });
  };

  const error = (title: string, message?: string) => {
    addToast({ type: 'error', title, message });
  };

  const warning = (title: string, message?: string) => {
    addToast({ type: 'warning', title, message });
  };

  const info = (title: string, message?: string) => {
    addToast({ type: 'info', title, message });
  };

  return {
    toasts,
    removeToast,
    success,
    error,
    warning,
    info,
  };
}
