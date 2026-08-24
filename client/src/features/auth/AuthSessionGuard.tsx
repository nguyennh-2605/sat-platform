import { useEffect } from 'react';
import {
  AUTH_SESSION_UPDATED_EVENT,
  clearAuthSession,
  getAccessToken,
  getAuthStatus,
  getTokenExpirationTime,
  initializeAuthSession,
  refreshAccessToken,
} from '../../lib/authSession';

const REFRESH_EARLY_MS = 60_000;
const MAX_TIMER_DELAY = 2_147_000_000;

export function AuthSessionGuard() {
  useEffect(() => {
    let refreshTimer: number | undefined;

    const scheduleRefresh = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      const expiration = getTokenExpirationTime(getAccessToken());
      if (!expiration || getAuthStatus() !== 'authenticated') return;

      const delay = expiration - Date.now() - REFRESH_EARLY_MS;
      refreshTimer = window.setTimeout(async () => {
        try { await refreshAccessToken(); } finally { scheduleRefresh(); }
      }, Math.min(Math.max(0, delay), MAX_TIMER_DELAY));
    };

    const restoreAndSchedule = async () => {
      await initializeAuthSession();
      scheduleRefresh();
    };

    const checkVisibleSession = () => {
      if (document.visibilityState !== 'visible') return;
      const expiration = getTokenExpirationTime(getAccessToken());
      if (expiration && expiration - Date.now() <= REFRESH_EARLY_MS) {
        void refreshAccessToken().finally(scheduleRefresh);
      } else {
        scheduleRefresh();
      }
    };

    const synchronizeTabs = () => {
      if (localStorage.getItem('isLoggedIn') === 'true') {
        if (getAuthStatus() !== 'authenticated') void refreshAccessToken({ redirectOnFailure: false });
      } else if (getAuthStatus() === 'authenticated') {
        clearAuthSession();
      }
    };

    void restoreAndSchedule();
    window.addEventListener('focus', checkVisibleSession);
    window.addEventListener('storage', synchronizeTabs);
    window.addEventListener(AUTH_SESSION_UPDATED_EVENT, scheduleRefresh);
    document.addEventListener('visibilitychange', checkVisibleSession);

    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      window.removeEventListener('focus', checkVisibleSession);
      window.removeEventListener('storage', synchronizeTabs);
      window.removeEventListener(AUTH_SESSION_UPDATED_EVENT, scheduleRefresh);
      document.removeEventListener('visibilitychange', checkVisibleSession);
    };
  }, []);

  return null;
}
