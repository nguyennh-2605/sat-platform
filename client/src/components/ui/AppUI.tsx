import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Bell, X } from 'lucide-react';
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
  showProfile = true,
  showNotifications = true,
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
    <header className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center justify-between border-b border-[#C9D8D2] bg-white px-6">
      <div className="flex w-[280px] min-w-0 flex-col justify-center">
        <h1 className="truncate text-base font-semibold leading-tight text-[#1A1A1A]">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-xs leading-tight text-[#6B7280]">{subtitle}</p>}
      </div>

      <div className="flex h-full min-w-0 flex-1 items-center justify-center">{centerContent}</div>

      <div className="flex w-[280px] items-center justify-end gap-5">
        {rightContent}
        {showProfile && (
          <>
            {showNotifications && <button className="relative text-[#6B7280] transition-colors hover:text-[#1A1A1A]" aria-label="Notifications">
              <Bell size={20} />
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
            </button>}
            <div
              className="flex h-8 w-8 select-none items-center justify-center rounded-full bg-[#1B7A5A] text-xs font-semibold text-white ring-2 ring-transparent ring-offset-2 ring-offset-white transition-all hover:ring-[#1B7A5A]/30"
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
  primary: 'bg-[#1B7A5A] text-white hover:bg-[#145F47]',
  outline: 'border border-[#1B7A5A] bg-white text-[#1B7A5A] hover:bg-[#E8F5EF]',
  accent: 'bg-[#E8C040] text-[#1A1A1A] hover:bg-[#D9B138]',
  ghost: 'bg-transparent text-[#6B7280] shadow-none hover:bg-[#EAF2EE] hover:text-[#1A1A1A]',
  destructive: 'bg-red-600 text-white hover:bg-red-700',
};

const buttonSizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-9 gap-2 px-4 text-sm',
  lg: 'h-10 gap-2 px-5 text-sm',
  icon: 'h-9 w-9 p-0',
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
        'inline-flex shrink-0 items-center justify-center rounded-lg font-medium shadow-sm transition-colors disabled:pointer-events-none disabled:opacity-50',
        buttonVariantClasses[variant],
        buttonSizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx(ui.card, className)} {...props} />;
}

type BadgeTone = 'green' | 'gold' | 'neutral' | 'success' | 'warning' | 'danger';

const badgeToneClasses: Record<BadgeTone, string> = {
  green: 'border-[#C2DDD4] bg-[#E8F5EF] text-[#1B7A5A]',
  gold: 'border-[#F0D070] bg-[#FEF9E7] text-[#92640A]',
  neutral: 'border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280]',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-red-200 bg-red-50 text-red-700',
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
        'h-9 rounded-lg border border-[#E2EDE9] bg-white px-3 text-sm text-[#1A1A1A] outline-none placeholder:text-[#6B7280] focus:border-[#1B7A5A] focus:ring-2 focus:ring-[#1B7A5A]/20',
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
        'h-9 cursor-pointer rounded-lg border border-[#E2EDE9] bg-white px-3 text-sm text-[#1A1A1A] outline-none focus:border-[#1B7A5A] focus:ring-2 focus:ring-[#1B7A5A]/20',
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
  if (!open) return null;

  const isContentPanel = presentation === 'content-panel';
  const isContentDialog = presentation === 'content-dialog';

  const modal = (
    <div
      className={isContentPanel
        ? 'absolute inset-0 z-[200] flex min-h-0 min-w-0 bg-white'
        : isContentDialog
          ? 'fixed inset-y-0 right-0 left-56 z-[200] flex min-h-0 min-w-0 items-center justify-center bg-[#0A1F16]/50 p-4'
          : 'fixed inset-0 z-[200] flex items-center justify-center bg-[#0A1F16]/50 p-4'}
      onMouseDown={event => { if (!isContentPanel && closeOnBackdrop && event.target === event.currentTarget) onClose(); }}
    >
      <div className={cx(
        isContentPanel
          ? 'flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-white'
          : isContentDialog
            ? 'flex min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[#E2EDE9] bg-white shadow-xl'
            : 'w-full max-w-lg overflow-hidden rounded-xl border border-[#E2EDE9] bg-white shadow-2xl',
        className,
      )}>
        <div className="flex items-start justify-between border-b border-[#E2EDE9] px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-[#1A1A1A]">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-[#6B7280]">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </Button>
        </div>
        <div className={isContentPanel || isContentDialog ? 'min-h-0 flex-1 overflow-hidden p-6' : 'p-6'}>{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t border-[#E2EDE9] bg-[#F2F8F5] px-6 py-4">{footer}</div>}
      </div>
    </div>
  );

  return isContentDialog ? createPortal(modal, document.body) : modal;
}

export function TableShell({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('overflow-hidden rounded-xl border border-[#E2EDE9] bg-white shadow-sm', className)} {...props} />;
}
