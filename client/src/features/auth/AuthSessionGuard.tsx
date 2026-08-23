import { useEffect } from 'react';
import {
  AUTH_SESSION_UPDATED_EVENT,
  endAuthSession,
  getTokenExpirationTime,
} from '../../lib/authSession';

const MAX_TIMER_DELAY = 2_147_000_000;

export function AuthSessionGuard() {
  useEffect(() => {
    let expirationTimer: number | undefined;

    const scheduleExpiration = () => {
      if (expirationTimer) window.clearTimeout(expirationTimer);
      const token = localStorage.getItem('token');
      if (!token) return;

      const expiration = getTokenExpirationTime(token);
      if (!expiration || expiration <= Date.now()) {
        endAuthSession('session-expired');
        return;
      }

      expirationTimer = window.setTimeout(
        scheduleExpiration,
        Math.min(expiration - Date.now(), MAX_TIMER_DELAY),
      );
    };

    const checkVisibleSession = () => {
      if (document.visibilityState === 'visible') scheduleExpiration();
    };

    scheduleExpiration();
    window.addEventListener('focus', scheduleExpiration);
    window.addEventListener('storage', scheduleExpiration);
    window.addEventListener(AUTH_SESSION_UPDATED_EVENT, scheduleExpiration);
    document.addEventListener('visibilitychange', checkVisibleSession);

    return () => {
      if (expirationTimer) window.clearTimeout(expirationTimer);
      window.removeEventListener('focus', scheduleExpiration);
      window.removeEventListener('storage', scheduleExpiration);
      window.removeEventListener(AUTH_SESSION_UPDATED_EVENT, scheduleExpiration);
      document.removeEventListener('visibilitychange', checkVisibleSession);
    };
  }, []);

  return null;
}
