import toast, { type DefaultToastOptions, type ToastOptions } from 'react-hot-toast';

export const APP_TOAST_OPTIONS: DefaultToastOptions = {
  duration: 4_000,
  className: 'app-toast',
  success: { duration: 3_000, iconTheme: { primary: 'var(--ui-success)', secondary: 'var(--ui-surface)' } },
  error: { duration: 5_000, iconTheme: { primary: 'var(--ui-danger)', secondary: 'var(--ui-surface)' } },
};

export const appToast = {
  success: (message: string, options?: ToastOptions) => toast.success(message, options),
  error: (message: string, options?: ToastOptions) => toast.error(message, options),
  loading: (message: string, options?: ToastOptions) => toast.loading(message, options),
  dismiss: (toastId?: string) => toast.dismiss(toastId),
};
