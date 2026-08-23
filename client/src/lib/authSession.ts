export interface AuthSessionUser {
  id: string | number;
  name?: string | null;
  avatar?: string | null;
  role?: string | null;
}

const AUTH_STORAGE_KEYS = ['token', 'isLoggedIn', 'userId', 'userName', 'userAvatar', 'userRole'] as const;
const SESSION_UPDATED_EVENT = 'auth:session-updated';
let endingSession = false;

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

export const hasValidAuthSession = () => isTokenValid(localStorage.getItem('token'));

export const storeAuthSession = (token: string, user: AuthSessionUser, fallbackRole = 'STUDENT') => {
  localStorage.setItem('token', token);
  localStorage.setItem('isLoggedIn', 'true');
  localStorage.setItem('userId', String(user.id));
  localStorage.setItem('userName', user.name || 'Student');
  localStorage.setItem('userAvatar', user.avatar || '');
  localStorage.setItem('userRole', user.role || fallbackRole);
  window.dispatchEvent(new Event(SESSION_UPDATED_EVENT));
};

export const clearAuthSession = () => {
  AUTH_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
  window.dispatchEvent(new Event(SESSION_UPDATED_EVENT));
};

export const endAuthSession = (reason: 'session-expired' | 'unauthorized' = 'session-expired') => {
  clearAuthSession();
  if (endingSession || window.location.pathname === '/auth') return;
  endingSession = true;
  window.location.replace(`/auth?reason=${reason}`);
};

export const handleUnauthorizedStatus = (status: number) => {
  if (status === 401) endAuthSession('session-expired');
};

export const authenticatedFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  if (!isTokenValid(token)) {
    endAuthSession('session-expired');
    throw new DOMException('Session expired', 'AbortError');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(input, { ...init, headers });
  handleUnauthorizedStatus(response.status);
  return response;
};

export const AUTH_SESSION_UPDATED_EVENT = SESSION_UPDATED_EVENT;
