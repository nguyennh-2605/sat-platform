import { afterEach, describe, expect, it, vi } from 'vitest';

const jwtWithExpiration = (expirationSeconds: number) => {
  const header = window.btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = window.btoa(JSON.stringify({ exp: expirationSeconds }));
  return `${header}.${payload}.signature`;
};

const loadSessionModule = async () => {
  vi.resetModules();
  return import('./authSession');
};

describe('auth session', () => {
  afterEach(() => vi.restoreAllMocks());

  it('accepts only tokens whose expiration is still in the future', async () => {
    const { getTokenExpirationTime, isTokenValid } = await loadSessionModule();
    const now = Date.now();
    const token = jwtWithExpiration(Math.floor(now / 1000) + 60);

    expect(getTokenExpirationTime(token)).toBeGreaterThan(now);
    expect(isTokenValid(token, now)).toBe(true);
    expect(isTokenValid(token, now + 61_000)).toBe(false);
    expect(isTokenValid('not-a-jwt', now)).toBe(false);
  });

  it('keeps access tokens in memory and persists only safe user metadata', async () => {
    const session = await loadSessionModule();
    const token = jwtWithExpiration(Math.floor(Date.now() / 1000) + 60);
    localStorage.setItem('token', 'legacy-token');

    session.storeAuthSession(token, { id: 42, name: 'Student', avatar: null, role: 'STUDENT' });

    expect(session.getAccessToken()).toBe(token);
    expect(session.getAuthStatus()).toBe('authenticated');
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('userId')).toBe('42');
    expect(localStorage.getItem('userRole')).toBe('STUDENT');
  });

  it('clears both in-memory authentication and persisted session metadata', async () => {
    const session = await loadSessionModule();
    const token = jwtWithExpiration(Math.floor(Date.now() / 1000) + 60);
    session.storeAuthSession(token, { id: 7, role: 'TEACHER' });

    session.clearAuthSession();

    expect(session.getAccessToken()).toBeNull();
    expect(session.getAuthStatus()).toBe('anonymous');
    expect(localStorage.getItem('isLoggedIn')).toBeNull();
    expect(localStorage.getItem('userRole')).toBeNull();
  });
});
