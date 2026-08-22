import type { InternalAxiosRequestConfig } from 'axios';

type TrackedRequestConfig = InternalAxiosRequestConfig & {
  __requestActivityToken?: number;
};

const activeRequests = new Set<number>();
const listeners = new Set<() => void>();
let nextToken = 1;

const notify = () => listeners.forEach(listener => listener());

export const trackRequestStart = (config: InternalAxiosRequestConfig) => {
  const trackedConfig = config as TrackedRequestConfig;
  const token = nextToken++;
  trackedConfig.__requestActivityToken = token;
  activeRequests.add(token);
  notify();
  return config;
};

export const trackRequestEnd = (config?: InternalAxiosRequestConfig) => {
  const token = (config as TrackedRequestConfig | undefined)?.__requestActivityToken;
  if (!token || !activeRequests.delete(token)) return;
  notify();
};

export const getRequestActivityCursor = () => nextToken - 1;

export const hasPendingRequestsAfter = (cursor: number) => (
  Array.from(activeRequests).some(token => token > cursor)
);

export const subscribeRequestActivity = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
