export interface AuthSessionUser {
  id: string | number;
  name?: string | null;
  avatar?: string | null;
  role?: string | null;
}

interface AuthResponse {
  accessToken: string;
  user: AuthSessionUser;
}

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

const AUTH_STORAGE_KEYS = ['token', 'isLoggedIn', 'userId', 'userName', 'userAvatar', 'userRole'] as const;
const SESSION_UPDATED_EVENT = 'auth:session-updated';
const API_URL = import.meta.env.VITE_API_URL || '';
let accessToken: string | null = null;
let authStatus: AuthStatus = 'loading';
let refreshPromise: Promise<string | null> | null = null;
let initializePromise: Promise<void> | null = null;
let endingSession = false;
const listeners = new Set<() => void>();

const notify = () => {
  window.dispatchEvent(new Event(SESSION_UPDATED_EVENT));
  listeners.forEach(listener => listener());
};

const setStatus = (status: AuthStatus) => {
  if (authStatus === status) return;
  authStatus = status;
  notify();
};

const decodeJwtPayload = (token: string): { exp?: number } | null => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(window.atob(padded)) as { exp?: number };
  } catch {
    return null;
  }
};

export const getTokenExpirationTime = (token: string | null) => {
  if (!token) return null;
  const expiration = decodeJwtPayload(token)?.exp;
  return typeof expiration === 'number' ? expiration * 1000 : null;
};

export const isTokenValid = (token: string | null, now = Date.now()) => {
  const expiration = getTokenExpirationTime(token);
  return Boolean(token && expiration && expiration > now);
};

const persistUser = (user: AuthSessionUser, fallbackRole = 'STUDENT') => {
  localStorage.setItem('isLoggedIn', 'true');
  localStorage.setItem('userId', String(user.id));
  localStorage.setItem('userName', user.name || 'Student');
  localStorage.setItem('userAvatar', user.avatar || '');
  localStorage.setItem('userRole', user.role || fallbackRole);
};

const applyAuthResponse = (response: AuthResponse, fallbackRole = 'STUDENT') => {
  accessToken = response.accessToken;
  localStorage.removeItem('token');
  persistUser(response.user, fallbackRole);
  authStatus = 'authenticated';
  endingSession = false;
  notify();
  return accessToken;
};

export const getAccessToken = () => accessToken;
export const getAuthStatus = () => authStatus;
export const subscribeAuthSession = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const hasValidAuthSession = () => authStatus === 'authenticated' && isTokenValid(accessToken);

export const storeAuthSession = (token: string, user: AuthSessionUser, fallbackRole = 'STUDENT') => {
  applyAuthResponse({ accessToken: token, user }, fallbackRole);
};

export const clearAuthSession = () => {
  accessToken = null;
  AUTH_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
  authStatus = 'anonymous';
  notify();
};

export const endAuthSession = (reason: 'session-expired' | 'unauthorized' = 'session-expired') => {
  clearAuthSession();
  if (endingSession || window.location.pathname === '/auth') return;
  endingSession = true;
  window.location.replace(`/auth?reason=${reason}`);
};

const parseAuthResponse = async (response: Response) => {
  const data = await response.json() as Partial<AuthResponse>;
  if (!data.accessToken || !data.user) throw new Error('Authentication response is incomplete.');
  return data as AuthResponse;
};

const requestRefresh = async (allowRotationRetry = true): Promise<string | null> => {
  const response = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRF-Intent': 'refresh' },
  });

  if (response.status === 409 && allowRotationRetry) {
    await new Promise(resolve => window.setTimeout(resolve, 150));
    return requestRefresh(false);
  }
  if (!response.ok) return null;
  return applyAuthResponse(await parseAuthResponse(response));
};

export const refreshAccessToken = async ({ redirectOnFailure = true } = {}) => {
  if (!refreshPromise) {
    refreshPromise = requestRefresh()
      .then(token => {
        if (!token) {
          clearAuthSession();
          if (redirectOnFailure) endAuthSession('session-expired');
        }
        return token;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
};

const upgradeLegacySession = async (legacyToken: string) => {
  const response = await fetch(`${API_URL}/api/auth/upgrade`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${legacyToken}`,
      'X-CSRF-Intent': 'upgrade',
    },
  });
  if (!response.ok) return null;
  return applyAuthResponse(await parseAuthResponse(response));
};

export const initializeAuthSession = async () => {
  if (initializePromise) return initializePromise;
  initializePromise = (async () => {
    const legacyToken = localStorage.getItem('token');
    localStorage.removeItem('token');
    if (isTokenValid(legacyToken)) {
      accessToken = legacyToken;
      setStatus('authenticated');
      try { await upgradeLegacySession(legacyToken as string); } catch { /* Retain the legacy token in memory for this tab. */ }
      return;
    }

    try {
      const refreshed = await refreshAccessToken({ redirectOnFailure: false });
      if (!refreshed) setStatus('anonymous');
    } catch {
      setStatus('anonymous');
    }
  })();
  return initializePromise;
};

export const getValidAccessToken = async () => {
  if (isTokenValid(accessToken, Date.now() + 5_000)) return accessToken;
  return refreshAccessToken();
};

export const logoutAuthSession = async () => {
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Intent': 'logout' },
    });
  } finally {
    clearAuthSession();
  }
};

export const authenticatedFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const send = async (token: string) => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers, credentials: init.credentials || 'include' });
  };

  const token = await getValidAccessToken();
  if (!token) throw new DOMException('Session expired', 'AbortError');
  let response = await send(token);
  if (response.status === 401) {
    const refreshedToken = await refreshAccessToken();
    if (!refreshedToken) throw new DOMException('Session expired', 'AbortError');
    response = await send(refreshedToken);
  }
  return response;
};

export const AUTH_SESSION_UPDATED_EVENT = SESSION_UPDATED_EVENT;
