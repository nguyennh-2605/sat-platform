import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const spinnerSizes = {
  xs: 'size-3',
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-7',
} as const;

interface LoadingSpinnerProps extends Omit<React.ComponentProps<typeof LoaderCircle>, 'size'> {
  size?: keyof typeof spinnerSizes;
  label?: string;
}

function LoadingSpinner({ size = 'sm', label, className, ...props }: LoadingSpinnerProps) {
  return (
    <LoaderCircle
      data-slot="loading-spinner"
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('shrink-0 animate-spin text-current', spinnerSizes[size], className)}
      {...props}
    />
  );
}

interface LoadingStateProps extends React.ComponentProps<'div'> {
  label?: string;
  description?: string;
  compact?: boolean;
}

function LoadingState({
  label = 'Loading…',
  description,
  compact = false,
  className,
  ...props
}: LoadingStateProps) {
  return (
    <div
      data-slot="loading-state"
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-center text-muted-foreground',
        compact ? 'gap-2 py-4 text-sm' : 'min-h-48 flex-col gap-3 p-6 text-center',
        className,
      )}
      {...props}
    >
      <LoadingSpinner size={compact ? 'sm' : 'lg'} />
      <div>
        <p className="font-medium text-foreground">{label}</p>
        {description && <p className="mt-1 max-w-md text-sm leading-5">{description}</p>}
      </div>
    </div>
  );
}

export { LoadingSpinner, LoadingState };
