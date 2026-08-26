/* eslint-disable react-refresh/only-export-components -- Provider and registration hooks intentionally share this navigation contract. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

interface DashboardBackRegistration {
  id: symbol;
  onBack: () => void;
  priority: number;
}

type RegisterBack = (registration: DashboardBackRegistration) => () => void;

const DashboardBackRegistrationContext = createContext<RegisterBack | null>(null);
const DashboardBackActionContext = createContext<(() => void) | null>(null);

export function DashboardBackProvider({ children }: { children: ReactNode }) {
  const [registrations, setRegistrations] = useState<DashboardBackRegistration[]>([]);

  const registerBack = useCallback((next: DashboardBackRegistration) => {
    setRegistrations(current => [...current.filter(item => item.id !== next.id), next]);
    return () => setRegistrations(current => current.filter(item => item.id !== next.id));
  }, []);

  const activeBack = useMemo(() => registrations.reduce<DashboardBackRegistration | null>((active, item) => (
    !active || item.priority >= active.priority ? item : active
  ), null)?.onBack ?? null, [registrations]);
  return (
    <DashboardBackRegistrationContext.Provider value={registerBack}>
      <DashboardBackActionContext.Provider value={activeBack}>{children}</DashboardBackActionContext.Provider>
    </DashboardBackRegistrationContext.Provider>
  );
}

export function useDashboardBackAction() {
  return useContext(DashboardBackActionContext);
}

export function useDashboardBack(onBack: () => void, active = true, priority = 0) {
  const registerBack = useContext(DashboardBackRegistrationContext);
  const handlerRef = useRef(onBack);
  handlerRef.current = onBack;
  const registrationIdRef = useRef(Symbol('dashboard-back'));

  useEffect(() => {
    if (!active || !registerBack) return;
    return registerBack({
      id: registrationIdRef.current,
      onBack: () => handlerRef.current(),
      priority,
    });
  }, [active, priority, registerBack]);
}
