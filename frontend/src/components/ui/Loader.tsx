import { cn } from '@/utils/cn';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'spinner' | 'dots' | 'pulse';
  className?: string;
  text?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

const spinnerSizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-[3px]',
  xl: 'h-12 w-12 border-[4px]',
};

export function Loader({ 
  size = 'md', 
  variant = 'spinner',
  className,
  text
}: LoaderProps) {
  if (variant === 'spinner') {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-2', className)}>
        <div
          className={cn(
            'animate-spin rounded-full border-slate-300 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-300',
            spinnerSizeClasses[size]
          )}
          role="status"
          aria-label="Chargement"
        >
          <span className="sr-only">Chargement...</span>
        </div>
        {text && (
          <p className="text-sm text-slate-600 dark:text-slate-400">{text}</p>
        )}
      </div>
    );
  }

  if (variant === 'dots') {
    return (
      <div className={cn('flex items-center justify-center gap-1', className)}>
        <div
          className={cn(
            'rounded-full bg-slate-600 dark:bg-slate-300 animate-bounce',
            sizeClasses[size]
          )}
          style={{ animationDelay: '0ms' }}
        />
        <div
          className={cn(
            'rounded-full bg-slate-600 dark:bg-slate-300 animate-bounce',
            sizeClasses[size]
          )}
          style={{ animationDelay: '150ms' }}
        />
        <div
          className={cn(
            'rounded-full bg-slate-600 dark:bg-slate-300 animate-bounce',
            sizeClasses[size]
          )}
          style={{ animationDelay: '300ms' }}
        />
        {text && (
          <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">{text}</span>
        )}
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-2', className)}>
        <div
          className={cn(
            'rounded-full bg-slate-600 dark:bg-slate-300 animate-pulse',
            sizeClasses[size]
          )}
          role="status"
          aria-label="Chargement"
        >
          <span className="sr-only">Chargement...</span>
        </div>
        {text && (
          <p className="text-sm text-slate-600 dark:text-slate-400">{text}</p>
        )}
      </div>
    );
  }

  return null;
}

// Composant de chargement plein écran
export function FullScreenLoader({ text = 'Chargement...' }: { text?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <Loader size="xl" variant="spinner" />
        {text && (
          <p className="text-lg font-medium text-slate-700 dark:text-slate-300">{text}</p>
        )}
      </div>
    </div>
  );
}

// Composant de chargement inline pour les boutons
export function ButtonLoader({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <Loader 
      size={size} 
      variant="spinner" 
      className="inline-flex"
    />
  );
}

