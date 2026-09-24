import { useCallback, useEffect, useState } from 'react';

export type DashboardTheme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'dashboardTheme';
const CHANGE_EVENT = 'dashboard-theme-changed';
const systemQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

export const getDashboardTheme = (): DashboardTheme => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'dark' || stored === 'system' ? stored : 'light';
};

export const applyDashboardTheme = (theme = getDashboardTheme()) => {
  const dark = theme === 'dark' || (theme === 'system' && systemQuery().matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
};

export const initializeDashboardTheme = () => applyDashboardTheme();

export function useDashboardTheme() {
  const [theme, setThemeState] = useState<DashboardTheme>(getDashboardTheme);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const media = systemQuery();
    const synchronize = () => {
      const next = getDashboardTheme();
      setThemeState(next);
      applyDashboardTheme(next);
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    const synchronizeSystem = () => {
      if (getDashboardTheme() === 'system') {
        applyDashboardTheme('system');
        setIsDark(document.documentElement.classList.contains('dark'));
      }
    };
    window.addEventListener(CHANGE_EVENT, synchronize);
    window.addEventListener('storage', synchronize);
    media.addEventListener('change', synchronizeSystem);
    synchronize();
    return () => {
      window.removeEventListener(CHANGE_EVENT, synchronize);
      window.removeEventListener('storage', synchronize);
      media.removeEventListener('change', synchronizeSystem);
    };
  }, []);

  const setTheme = useCallback((next: DashboardTheme) => {
    localStorage.setItem(STORAGE_KEY, next);
    applyDashboardTheme(next);
    setThemeState(next);
    setIsDark(document.documentElement.classList.contains('dark'));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { theme, isDark, setTheme };
}
