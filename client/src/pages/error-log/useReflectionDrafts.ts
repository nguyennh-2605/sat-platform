import { useCallback, useEffect, useRef, useState } from 'react';
import axiosClient from '../../lib/axios';
import { invalidateQueryCache } from '../../lib/queryCache';
import type { ErrorEntry } from './types';

export type EditableField = 'whyWrong' | 'whyRight';
export type CellDraft = { value: string; status: 'pending' | 'saving' | 'saved' | 'error'; error?: string };
export const cellKey = (id: string, field: EditableField) => `${id}:${field}`;

// Drafts and save queues live above virtual rows so scrolling cannot discard edits.
export function useReflectionDrafts(onSaved: (entry: ErrorEntry) => void) {
  const [drafts, setDrafts] = useState<Record<string, CellDraft>>({});
  const current = useRef<Record<string, CellDraft>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const queues = useRef(new Map<string, Promise<void>>());
  const onSavedRef = useRef(onSaved);
  useEffect(() => { onSavedRef.current = onSaved; }, [onSaved]);

  const publish = useCallback((key: string, draft: CellDraft) => {
    current.current = { ...current.current, [key]: draft };
    setDrafts(current.current);
  }, []);

  const flush = useCallback((id: string, field: EditableField) => {
    const key = cellKey(id, field);
    clearTimeout(timers.current.get(key));
    timers.current.delete(key);
    const draft = current.current[key];
    if (!draft || draft.status === 'saved' || draft.status === 'saving') return;
    publish(key, { ...draft, status: 'saving' });
    const operation = (queues.current.get(id) || Promise.resolve()).then(async () => {
      try {
        const data = await axiosClient.patch<ErrorEntry>(`/api/error-logs/${id}`, { [field]: draft.value || null });
        invalidateQueryCache('/api/error-logs');
        onSavedRef.current(data);
        if (current.current[key]?.value === draft.value) publish(key, { value: data[field] || '', status: 'saved' });
      } catch (error) {
        if (current.current[key]?.value === draft.value) publish(key, {
          ...draft, status: 'error', error: (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Could not save. Retry when connected.',
        });
      }
    });
    queues.current.set(id, operation);
    void operation.finally(() => { if (queues.current.get(id) === operation) queues.current.delete(id); });
  }, [publish]);

  const change = useCallback((id: string, field: EditableField, value: string) => {
    const key = cellKey(id, field);
    publish(key, { value, status: 'pending' });
    clearTimeout(timers.current.get(key));
    timers.current.set(key, setTimeout(() => flush(id, field), 850));
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
  return { drafts, change, flush };
}
