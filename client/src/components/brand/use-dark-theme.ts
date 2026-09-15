import { useSyncExternalStore } from 'react';

const getSnapshot = () => document.documentElement.classList.contains('dark');
const getServerSnapshot = () => false;

const subscribe = (onStoreChange: () => void) => {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
};

export function useDarkTheme() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
