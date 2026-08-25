import axiosClient from './axios';

interface CacheEntry<T> {
  url: string;
  expiresAt: number;
  data?: T;
  promise?: Promise<T>;
}

const entries = new Map<string, CacheEntry<unknown>>();
const userNamespace = () => localStorage.getItem('userId') || 'anonymous';
const cacheKey = (url: string) => `${userNamespace()}:${url}`;

export const cachedGet = <T>(url: string, options: { ttlMs?: number; force?: boolean } = {}): Promise<T> => {
  const key = cacheKey(url);
  const existing = entries.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();
  if (!options.force && existing?.data !== undefined && existing.expiresAt > now) return Promise.resolve(existing.data);
  if (!options.force && existing?.promise) return existing.promise;

  const promise = axiosClient.get<T, T>(url).then(data => {
    entries.set(key, { url, data, expiresAt: Date.now() + (options.ttlMs ?? 30_000) });
    return data;
  }).catch(error => {
    if (entries.get(key)?.promise === promise) entries.delete(key);
    throw error;
  });
  entries.set(key, { url, promise, expiresAt: now });
  return promise;
};

export const invalidateQueryCache = (...prefixes: string[]) => {
  for (const [key, entry] of entries) {
    if (prefixes.some(prefix => entry.url.startsWith(prefix))) entries.delete(key);
  }
};
