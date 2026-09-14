import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
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
export type DraftSummary = { status: CellDraft['status'] | 'idle'; revision: number };
type Listener = () => void;

export type ReflectionDraftStore = {
  getDraft: (key: string) => CellDraft | undefined;
  getSummary: () => DraftSummary;
  isRowDirty: (id: string) => boolean;
  subscribe: (key: string, listener: Listener) => () => void;
  subscribeRow: (id: string, listener: Listener) => () => void;
  subscribeSummary: (listener: Listener) => () => void;
};

export const cellKey = (id: string, field: EditableField) => `${id}:${field}`;

const subscribeTo = (listeners: Map<string, Set<Listener>>, key: string, listener: Listener) => {
  const keyListeners = listeners.get(key) ?? new Set<Listener>();
  keyListeners.add(listener);
  listeners.set(key, keyListeners);
  return () => {
    keyListeners.delete(listener);
    if (keyListeners.size === 0) listeners.delete(key);
  };
};

const summaryStatus = (counts: Record<CellDraft['status'], number>): DraftSummary['status'] => {
  if (counts.error > 0) return 'error';
  if (counts.saving > 0) return 'saving';
  if (counts.pending > 0) return 'pending';
  if (counts.saved > 0) return 'saved';
  return 'idle';
};

// The registry lives above virtual rows, while keyed subscriptions keep typing
// local to the active cell instead of re-rendering the entire Error Log page.
export function useReflectionDrafts(
  onSaved: (entry: ErrorEntry) => void,
  getVersion: (id: string) => number | undefined,
) {
  const drafts = useRef(new Map<string, CellDraft>());
  const cellListeners = useRef(new Map<string, Set<Listener>>());
  const rowListeners = useRef(new Map<string, Set<Listener>>());
  const summaryListeners = useRef(new Set<Listener>());
  const summary = useRef<DraftSummary>({ status: 'idle', revision: 0 });
  const summaryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusCounts = useRef<Record<CellDraft['status'], number>>({ pending: 0, saving: 0, saved: 0, error: 0 });
  const dirtyRows = useRef(new Map<string, boolean>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const queues = useRef(new Map<string, Promise<void>>());
  const latestVersions = useRef(new Map<string, number>());
  const onSavedRef = useRef(onSaved);
  const getVersionRef = useRef(getVersion);
  useEffect(() => { onSavedRef.current = onSaved; }, [onSaved]);
  useEffect(() => { getVersionRef.current = getVersion; }, [getVersion]);

  const publish = useCallback((key: string, draft: CellDraft) => {
    if (summaryTimer.current) {
      clearTimeout(summaryTimer.current);
      summaryTimer.current = null;
    }
    const previousSummary = summary.current.status;
    const previousDraft = drafts.current.get(key);
    if (previousDraft) statusCounts.current[previousDraft.status] -= 1;
    statusCounts.current[draft.status] += 1;
    drafts.current.set(key, draft);
    cellListeners.current.get(key)?.forEach(listener => listener());
    const [id] = key.split(':');
    dirtyRows.current.set(id, ['whyWrong', 'whyRight'].some(field => {
      const rowDraft = drafts.current.get(cellKey(id, field as EditableField));
      return Boolean(rowDraft && rowDraft.status !== 'saved');
    }));
    rowListeners.current.get(id)?.forEach(listener => listener());
    const nextSummary = summaryStatus(statusCounts.current);
    if (previousSummary !== nextSummary || nextSummary === 'saved') {
      summary.current = { status: nextSummary, revision: summary.current.revision + 1 };
      summaryListeners.current.forEach(listener => listener());
      if (nextSummary === 'saved') {
        const savedRevision = summary.current.revision;
        summaryTimer.current = setTimeout(() => {
          if (summary.current.status !== 'saved' || summary.current.revision !== savedRevision) return;
          summary.current = { status: 'idle', revision: savedRevision + 1 };
          summaryListeners.current.forEach(listener => listener());
          summaryTimer.current = null;
        }, 1600);
      }
    }
  }, []);

  const flush = useCallback((id: string, field: EditableField) => {
    const key = cellKey(id, field);
    clearTimeout(timers.current.get(key));
    timers.current.delete(key);
    const draft = drafts.current.get(key);
    if (!draft || draft.status === 'saved' || draft.status === 'saving' || draft.conflict) return;
    publish(key, { ...draft, status: 'saving' });
    const operation = (queues.current.get(id) || Promise.resolve()).then(async () => {
      try {
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
        if (drafts.current.get(key)?.value === draft.value) publish(key, { value: data[field] || '', status: 'saved' });
      } catch (error) {
        const response = (error as { response?: { status?: number; data?: { message?: string; current?: ErrorEntry } } }).response;
        const status = response?.status;
        if (status === 409 && response?.data?.current) {
          const latest = response.data.current;
          if (latest.version !== undefined) latestVersions.current.set(id, latest.version);
          onSavedRef.current(latest);
          if (drafts.current.get(key)?.value === draft.value) publish(key, {
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
        if (drafts.current.get(key)?.value === draft.value) publish(key, { ...draft, status: 'error', error: message });
      }
    });
    queues.current.set(id, operation);
    void operation.finally(() => {
      if (queues.current.get(id) === operation) queues.current.delete(id);
    });
  }, [publish]);

  const change = useCallback((id: string, field: EditableField, value: string) => {
    const key = cellKey(id, field);
    const conflict = drafts.current.get(key)?.conflict;
    publish(key, conflict
      ? { value, status: 'error', error: 'This entry changed in another tab. Choose which version to keep.', conflict }
      : { value, status: 'pending' });
    clearTimeout(timers.current.get(key));
    if (conflict) return;
    timers.current.set(key, setTimeout(() => flush(id, field), 850));
  }, [flush, publish]);

  const resolveConflict = useCallback((id: string, field: EditableField, resolution: 'latest' | 'mine') => {
    const key = cellKey(id, field);
    const draft = drafts.current.get(key);
    if (!draft?.conflict) return;
    if (resolution === 'latest') {
      publish(key, { value: draft.conflict.latestValue, status: 'saved' });
      return;
    }
    publish(key, { value: draft.value, status: 'pending' });
    flush(id, field);
  }, [flush, publish]);

  const store = useMemo<ReflectionDraftStore>(() => ({
      getDraft: key => drafts.current.get(key),
      getSummary: () => summary.current,
      isRowDirty: id => dirtyRows.current.get(id) ?? false,
      subscribe: (key, listener) => subscribeTo(cellListeners.current, key, listener),
      subscribeRow: (id, listener) => subscribeTo(rowListeners.current, id, listener),
      subscribeSummary: listener => {
        summaryListeners.current.add(listener);
        return () => summaryListeners.current.delete(listener);
      },
    }), []);

  useEffect(() => {
    const pendingTimers = timers.current;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if ([...drafts.current.values()].some(draft => draft.status !== 'saved')) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      if (summaryTimer.current) clearTimeout(summaryTimer.current);
      for (const key of pendingTimers.keys()) {
        const [id, field] = key.split(':');
        flush(id, field as EditableField);
      }
    };
  }, [flush]);

  return { store, change, flush, resolveConflict };
}

export function useCellDraft(store: ReflectionDraftStore, key: string) {
  const subscribe = useCallback((listener: Listener) => store.subscribe(key, listener), [key, store]);
  const getSnapshot = useCallback(() => store.getDraft(key), [key, store]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useRowDirty(store: ReflectionDraftStore, id: string) {
  const subscribe = useCallback((listener: Listener) => store.subscribeRow(id, listener), [id, store]);
  const getSnapshot = useCallback(() => store.isRowDirty(id), [id, store]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useDraftSummary(store: ReflectionDraftStore) {
  return useSyncExternalStore(store.subscribeSummary, store.getSummary, store.getSummary);
}
