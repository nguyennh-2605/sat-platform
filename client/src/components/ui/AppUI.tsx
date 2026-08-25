import type {
  ButtonHTMLAttributes,
  ElementType,
  HTMLAttributes,
  InputHTMLAttributes,
  KeyboardEvent,
  ReactNode,
  SelectHTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Inbox, X } from 'lucide-react';
import NotificationBell from '../../features/notifications/NotificationBell';
import { cx, ui } from './styles';

interface AppHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  centerContent?: ReactNode;
  rightContent?: ReactNode;
  showProfile?: boolean;
  showNotifications?: boolean;
}

export function AppHeader({
  title,
  subtitle,
  centerContent,
  rightContent,
  showProfile = false,
  showNotifications = false,
}: AppHeaderProps) {
  const userName = localStorage.getItem('userName') || 'Student';
  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'ST';

  return (
    <header className="sticky top-0 z-30 grid min-h-16 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-ui-border-strong bg-surface px-4 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col justify-center py-2">
        <h1 className="truncate text-heading font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-caption text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="hidden h-full min-w-0 items-center justify-center md:flex">{centerContent}</div>

      <div className="flex items-center justify-end gap-3 md:min-w-0">
        {rightContent}
        {showProfile && (
          <>
            {showNotifications && <NotificationBell currentUserId={localStorage.getItem('userId') || ''} />}
            <div
              className="flex h-8 min-h-8 w-8 min-w-8 shrink-0 select-none items-center justify-center rounded-full bg-primary text-caption font-semibold text-white ring-2 ring-transparent ring-offset-2 ring-offset-surface transition-shadow hover:ring-primary/30"
              title={userName}
            >
              {initials}
            </div>
          </>
        )}
      </div>
    </header>
  );
}

type ButtonVariant = 'primary' | 'outline' | 'accent' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  outline: 'border border-primary bg-surface text-primary hover:bg-primary-soft',
  accent: 'bg-accent text-foreground hover:bg-accent-hover',
  ghost: 'bg-transparent text-muted-foreground shadow-none hover:bg-muted hover:text-foreground',
  destructive: 'bg-danger text-white hover:bg-red-700',
};

const buttonSizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-3 text-caption',
  md: 'h-10 gap-2 px-4 text-body',
  lg: 'h-11 gap-2 px-5 text-body',
  icon: 'h-10 w-10 p-0',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ className, variant = 'primary', size = 'md', type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-control font-medium shadow-card transition-colors disabled:pointer-events-none disabled:opacity-50',
        buttonVariantClasses[variant],
        buttonSizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}

type BackButtonProps = Omit<ButtonProps, 'children' | 'variant' | 'size'> & {
  label?: string;
};

export function BackButton({ label = 'Back', className, ...props }: BackButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cx('px-2.5 text-subtle hover:text-primary-hover', className)}
      {...props}
    >
      <ArrowLeft size={16} aria-hidden="true" />
      {label}
    </Button>
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx(ui.card, className)} {...props} />;
}

export function LoadingBar({ active, className }: { active: boolean; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-label="Loading content"
      aria-hidden={!active}
      className={cx(
        'pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden bg-primary/10 transition-opacity duration-150',
        active ? 'opacity-100' : 'opacity-0',
        className,
      )}
    >
      <span className="page-loading-indicator block h-full rounded-full bg-primary" />
    </div>
  );
}

type BadgeTone = 'green' | 'gold' | 'neutral' | 'success' | 'warning' | 'danger';

const badgeToneClasses: Record<BadgeTone, string> = {
  green: 'border-primary/25 bg-primary-soft text-primary',
  gold: 'border-accent/60 bg-accent-soft text-warning',
  neutral: 'border-ui-border bg-background text-muted-foreground',
  success: 'border-success/20 bg-success-soft text-success',
  warning: 'border-warning/20 bg-warning-soft text-warning',
  danger: 'border-danger/20 bg-danger-soft text-danger',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cx('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold', badgeToneClasses[tone], className)}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        'h-10 rounded-control border border-ui-border bg-surface px-3 text-body text-foreground outline-hidden placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20',
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        'h-10 cursor-pointer rounded-control border border-ui-border bg-surface px-3 text-body text-foreground outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/20',
        className,
      )}
      {...props}
    />
  );
}

interface ModalProps {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  closeOnBackdrop?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  presentation?: 'dialog' | 'content-dialog' | 'content-panel';
}

export function Modal({ open, title, subtitle, onClose, closeOnBackdrop = false, children, footer, className, presentation = 'dialog' }: ModalProps) {
  const titleId = useId();
  const subtitleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusFirst = () => (dialog?.querySelector<HTMLElement>(focusableSelector) || dialog)?.focus();
    const frame = window.requestAnimationFrame(focusFirst);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [open]);

  if (!open) return null;

  const isContentPanel = presentation === 'content-panel';
  const isContentDialog = presentation === 'content-dialog';

  const modal = (
    <div
      className={isContentPanel
        ? 'absolute inset-0 z-200 flex min-h-0 min-w-0 bg-white'
        : isContentDialog
          ? 'fixed inset-0 z-200 flex min-h-0 min-w-0 items-center justify-center bg-(--ui-overlay) p-4 md:left-(--dashboard-sidebar-offset)'
          : 'fixed inset-0 z-200 flex items-center justify-center bg-(--ui-overlay) p-4'}
      onMouseDown={event => { if (!isContentPanel && closeOnBackdrop && event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
        className={cx(
        isContentPanel
          ? 'flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-surface'
          : isContentDialog
            ? 'flex min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-card border border-ui-border bg-surface shadow-overlay'
            : 'w-full max-w-lg overflow-hidden rounded-card border border-ui-border bg-surface shadow-overlay',
        className,
      )}>
        <div className="flex items-start justify-between border-b border-ui-border px-6 py-5">
          <div>
            <h2 id={titleId} className="text-heading font-semibold text-foreground">{title}</h2>
            {subtitle && <p id={subtitleId} className="mt-1 text-body text-muted-foreground">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </Button>
        </div>
        <div className={isContentPanel || isContentDialog ? 'min-h-0 flex-1 overflow-hidden p-6' : 'p-6'}>{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t border-ui-border bg-background px-6 py-4">{footer}</div>}
      </div>
    </div>
  );

  return isContentDialog ? createPortal(modal, document.body) : modal;
}

export function TableShell({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('overflow-hidden rounded-card border border-ui-border bg-surface shadow-card', className)} {...props} />;
}

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cx('w-full text-left text-body', className)} {...props} />;
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cx('border-b border-ui-border-strong bg-background text-caption font-medium text-subtle', className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cx('divide-y divide-ui-border', className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cx('transition-colors hover:bg-background/70', className)} {...props} />;
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cx('px-5 py-3 text-left font-medium', className)} {...props} />;
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cx('px-5 py-3', className)} {...props} />;
}

interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  surface?: boolean;
}

export function EmptyState({ icon, title, description, action, compact = false, surface = true, className, ...props }: EmptyStateProps) {
  const content = (
    <>
      <span className="flex h-10 w-10 items-center justify-center rounded-control bg-primary-soft text-primary" aria-hidden="true">
        {icon || <Inbox size={19} />}
      </span>
      <h3 className="mt-3 text-title font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-md text-body text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </>
  );
  const classes = cx('flex flex-col items-center justify-center text-center', compact ? 'min-h-40 p-6' : 'min-h-56 p-8', className);
  return surface ? <Card className={classes} {...props}>{content}</Card> : <div className={classes} {...props}>{content}</div>;
}

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ElementType;
  disabled?: boolean;
  panelId?: string;
}

interface TabsProps<T extends string> extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  items: Array<TabItem<T>>;
  value: T;
  onValueChange: (value: T) => void;
  ariaLabel: string;
  tabClassName?: string;
}

export function Tabs<T extends string>({ items, value, onValueChange, ariaLabel, className, tabClassName, ...props }: TabsProps<T>) {
  const baseId = useId();
  const selectTab = (item: TabItem<T>) => {
    if (!item.disabled) onValueChange(item.value);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const enabledIndexes = items.map((item, itemIndex) => item.disabled ? -1 : itemIndex).filter(itemIndex => itemIndex >= 0);
    if (!enabledIndexes.length) return;
    const currentPosition = enabledIndexes.indexOf(index);
    let nextIndex: number | undefined;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = enabledIndexes[(currentPosition + 1) % enabledIndexes.length];
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = enabledIndexes[(currentPosition - 1 + enabledIndexes.length) % enabledIndexes.length];
    if (event.key === 'Home') nextIndex = enabledIndexes[0];
    if (event.key === 'End') nextIndex = enabledIndexes[enabledIndexes.length - 1];
    if (nextIndex === undefined) return;
    event.preventDefault();
    selectTab(items[nextIndex]);
    event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]')[nextIndex]?.focus();
  };

  return (
    <div role="tablist" aria-label={ariaLabel} className={cx('flex min-w-0', className)} {...props}>
      {items.map((item, index) => {
        const active = item.value === value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            id={`${baseId}-${item.value}-tab`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={item.panelId}
            tabIndex={active ? 0 : -1}
            disabled={item.disabled}
            onClick={() => selectTab(item)}
            onKeyDown={event => handleKeyDown(event, index)}
            className={cx(
              'relative inline-flex h-10 shrink-0 items-center justify-center gap-1.5 px-4 text-body transition-colors disabled:pointer-events-none disabled:opacity-50',
              active ? 'font-medium text-primary' : 'text-muted-foreground hover:text-foreground',
              tabClassName,
            )}
          >
            {Icon && <Icon size={14} aria-hidden="true" />}
            {item.label}
            {active && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}
