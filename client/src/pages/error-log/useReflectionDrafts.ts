import { useCallback, useEffect, useRef, useState } from 'react';
import axiosClient from '../../lib/axios';
import { invalidateQueryCache } from '../../lib/queryCache';
import type { ErrorEntry } from './types';

export type EditableField = 'whyWrong' | 'whyRight';
export type CellDraft = {
  value: string;
  status: 'pending' | 'saving' | 'saved' | 'error';
  error?: string;
  conflict?: { latestValue: string };
};
export const cellKey = (id: string, field: EditableField) => `${id}:${field}`;

// Drafts and save queues live above virtual rows so scrolling cannot discard edits.
export function useReflectionDrafts(
  onSaved: (entry: ErrorEntry) => void,
  getVersion: (id: string) => number | undefined,
) {
  const [drafts, setDrafts] = useState<Record<string, CellDraft>>({});
  const current = useRef<Record<string, CellDraft>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const queues = useRef(new Map<string, Promise<void>>());
  const latestVersions = useRef(new Map<string, number>());
  const onSavedRef = useRef(onSaved);
  const getVersionRef = useRef(getVersion);
  useEffect(() => { onSavedRef.current = onSaved; }, [onSaved]);
  useEffect(() => { getVersionRef.current = getVersion; }, [getVersion]);

  const publish = useCallback((key: string, draft: CellDraft) => {
    current.current = { ...current.current, [key]: draft };
    setDrafts(current.current);
  }, []);

  const flush = useCallback((id: string, field: EditableField) => {
    const key = cellKey(id, field);
    clearTimeout(timers.current.get(key));
    timers.current.delete(key);
    const draft = current.current[key];
    if (!draft || draft.status === 'saved' || draft.status === 'saving' || draft.conflict) return;
    publish(key, { ...draft, status: 'saving' });
    const operation = (queues.current.get(id) || Promise.resolve()).then(async () => {
      try {
        // Resolve the version only when this queued save starts. The hook-local
        // version covers the React render gap after the preceding save returns.
        const renderedVersion = getVersionRef.current(id);
        const savedVersion = latestVersions.current.get(id);
        const expectedVersion = renderedVersion === undefined
          ? savedVersion
          : savedVersion === undefined
            ? renderedVersion
            : Math.max(renderedVersion, savedVersion);
        const data = await axiosClient.patch<ErrorEntry>(`/api/error-logs/${id}`, {
          [field]: draft.value || null,
          ...(expectedVersion !== undefined ? { expectedVersion } : {}),
        });
        if (data.version !== undefined) latestVersions.current.set(id, data.version);
        invalidateQueryCache('/api/error-logs');
        onSavedRef.current(data);
        if (current.current[key]?.value === draft.value) publish(key, { value: data[field] || '', status: 'saved' });
      } catch (error) {
        const response = (error as { response?: { status?: number; data?: { message?: string; current?: ErrorEntry } } }).response;
        const status = response?.status;
        if (status === 409 && response?.data?.current) {
          const latest = response.data.current;
          if (latest.version !== undefined) latestVersions.current.set(id, latest.version);
          onSavedRef.current(latest);
          if (current.current[key]?.value === draft.value) publish(key, {
            ...draft,
            status: 'error',
            error: 'This entry changed in another tab. Choose which version to keep.',
            conflict: { latestValue: latest[field] || '' },
          });
          return;
        }
        const message = status === 409
          ? 'This entry changed in another tab. Review the latest row, then retry your edit.'
          : error instanceof Error && !('response' in error)
            ? error.message
            : response?.data?.message || 'Could not save. Retry when connected.';
        if (current.current[key]?.value === draft.value) publish(key, {
          ...draft, status: 'error', error: message,
        });
      }
    });
    queues.current.set(id, operation);
    void operation.finally(() => { if (queues.current.get(id) === operation) queues.current.delete(id); });
  }, [publish]);

  const change = useCallback((id: string, field: EditableField, value: string) => {
    const key = cellKey(id, field);
    const conflict = current.current[key]?.conflict;
    publish(key, conflict
      ? { value, status: 'error', error: 'This entry changed in another tab. Choose which version to keep.', conflict }
      : { value, status: 'pending' });
    clearTimeout(timers.current.get(key));
    if (conflict) return;
    timers.current.set(key, setTimeout(() => flush(id, field), 850));
  }, [flush, publish]);

  const resolveConflict = useCallback((id: string, field: EditableField, resolution: 'latest' | 'mine') => {
    const key = cellKey(id, field);
    const draft = current.current[key];
    if (!draft?.conflict) return;
    if (resolution === 'latest') {
      publish(key, { value: draft.conflict.latestValue, status: 'saved' });
      return;
    }
    publish(key, { value: draft.value, status: 'pending' });
    flush(id, field);
  }, [flush, publish]);

  useEffect(() => {
    const pendingTimers = timers.current;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (Object.values(current.current).some(draft => draft.status !== 'saved')) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      for (const key of pendingTimers.keys()) {
        const [id, field] = key.split(':');
        flush(id, field as EditableField);
      }
    };
  }, [flush]);
  return { drafts, change, flush, resolveConflict };
}
