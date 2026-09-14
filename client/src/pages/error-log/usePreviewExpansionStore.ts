import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';

type Listener = () => void;

export interface PreviewExpansionStore {
  isExpanded: (key: string) => boolean;
  prune: (validKeys: Set<string>) => void;
  setExpanded: (key: string, expanded: boolean) => void;
  subscribe: (key: string, listener: Listener) => () => void;
}

// Expansion is UI state, but it lives above virtual rows so a preview does not
// collapse merely because Virtuoso temporarily unmounted it while scrolling.
export function usePreviewExpansionStore(): PreviewExpansionStore {
  const expandedKeys = useRef(new Set<string>());
  const listeners = useRef(new Map<string, Set<Listener>>());

  const setExpanded = useCallback((key: string, expanded: boolean) => {
    const changed = expanded
      ? !expandedKeys.current.has(key)
      : expandedKeys.current.has(key);
    if (!changed) return;
    if (expanded) expandedKeys.current.add(key);
    else expandedKeys.current.delete(key);
    listeners.current.get(key)?.forEach(listener => listener());
  }, []);

  const prune = useCallback((validKeys: Set<string>) => {
    for (const key of expandedKeys.current) {
      if (validKeys.has(key)) continue;
      expandedKeys.current.delete(key);
      listeners.current.get(key)?.forEach(listener => listener());
    }
  }, []);

  return useMemo(() => ({
    isExpanded: key => expandedKeys.current.has(key),
    prune,
    setExpanded,
    subscribe: (key, listener) => {
      const keyListeners = listeners.current.get(key) ?? new Set<Listener>();
      keyListeners.add(listener);
      listeners.current.set(key, keyListeners);
      return () => {
        keyListeners.delete(listener);
        if (keyListeners.size === 0) listeners.current.delete(key);
      };
    },
  }), [prune, setExpanded]);
}

export function usePreviewExpanded(store: PreviewExpansionStore, key: string) {
  const subscribe = useCallback((listener: Listener) => store.subscribe(key, listener), [key, store]);
  const getSnapshot = useCallback(() => store.isExpanded(key), [key, store]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
