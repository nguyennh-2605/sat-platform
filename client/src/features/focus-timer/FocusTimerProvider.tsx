import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import axiosClient from '@/lib/axios';
import { getAuthStatus, subscribeAuthSession } from '@/lib/authSession';
import { FocusTimerContext } from './focus-timer-context';
import { FOCUS_SESSION_CHANGED_EVENT, type StartFocusSessionInput, type StudyContextSuggestion, type StudySession, type StudySessionEnvelope } from './focus-timer.types';

const ACTIVE_STATUSES = new Set(['RUNNING', 'PAUSED']);
const SYNC_STORAGE_KEY = 'sat:focus-session-changed';

const messageFor = (error: unknown) => {
  const data = (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
  return data?.message || data?.error || 'Unable to update the focus session.';
};

const routeSuggestion = (pathname: string): StudyContextSuggestion => {
  const testMatch = pathname.match(/^\/test\/([^/]+)/);
  if (testMatch) return { activityType: 'PRACTICE', resourceType: 'TEST', resourceId: testMatch[1], label: 'Practice test' };
  if (pathname.startsWith('/dashboard/vocabulary')) return { activityType: 'VOCABULARY', label: 'Vocabulary review' };
  if (pathname.startsWith('/dashboard/error-log')) return { activityType: 'ERROR_LOG', label: 'Error Log review' };
  const assignmentMatch = pathname.match(/^\/dashboard\/class\/[^/]+\/assignment\/([^/]+)/);
  if (assignmentMatch) return { activityType: 'HOMEWORK', resourceType: 'ASSIGNMENT', resourceId: assignmentMatch[1], label: 'Class assignment' };
  if (pathname.startsWith('/dashboard/practice-test')) return { activityType: 'PRACTICE', label: 'SAT practice' };
  return { activityType: 'OTHER', label: 'Focused study' };
};

const localElapsed = (session: StudySession | null, nowMs: number) => {
  if (!session) return 0;
  let elapsed = session.accumulatedMs;
  if (session.status === 'RUNNING' && session.lastResumedAt) {
    elapsed += Math.max(0, nowMs - new Date(session.lastResumedAt).getTime());
  }
  return Math.min(session.plannedDurationMs, Math.max(0, elapsed));
};

export function FocusTimerProvider({ children }: { children: ReactNode }) {
  const authStatus = useSyncExternalStore(subscribeAuthSession, getAuthStatus, getAuthStatus);
  const location = useLocation();
  const role = authStatus === 'authenticated' ? localStorage.getItem('userRole') : null;
  const userId = authStatus === 'authenticated' ? localStorage.getItem('userId') : null;
  const enabled = role === 'STUDENT' && Boolean(userId);
  const [session, setSession] = useState<StudySession | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const autoFinishRef = useRef<string | null>(null);

  const applyEnvelope = useCallback((result: StudySessionEnvelope) => {
    const receivedAt = Date.now();
    setClockOffsetMs(new Date(result.serverNow).getTime() - receivedAt);
    setNowMs(receivedAt);
    setSession(result.session && ACTIVE_STATUSES.has(result.session.status) ? result.session : null);
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const result = await axiosClient.get<StudySessionEnvelope, StudySessionEnvelope>('/api/study-sessions/active');
      applyEnvelope(result);
      setError(null);
    } catch (requestError) {
      setError(messageFor(requestError));
    }
  }, [applyEnvelope, enabled]);

  const broadcastChange = useCallback(() => {
    const message = { type: 'SESSION_CHANGED', at: Date.now() };
    channelRef.current?.postMessage(message);
    try { localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(message)); } catch { /* Cross-tab sync is best effort. */ }
    window.dispatchEvent(new Event(FOCUS_SESSION_CHANGED_EVENT));
  }, []);

  useEffect(() => {
    if (!enabled) {
      setSession(null);
      setError(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    axiosClient.get<StudySessionEnvelope, StudySessionEnvelope>('/api/study-sessions/active')
      .then(result => { if (active) { applyEnvelope(result); setError(null); } })
      .catch(requestError => { if (active) setError(messageFor(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applyEnvelope, enabled, userId]);

  useEffect(() => {
    if (!enabled || !userId) return;
    const receiveChange = () => {
      void refresh();
      window.dispatchEvent(new Event(FOCUS_SESSION_CHANGED_EVENT));
    };
    const onStorage = (event: StorageEvent) => { if (event.key === SYNC_STORAGE_KEY) receiveChange(); };
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(`sat:focus-session:${userId}`);
    channelRef.current = channel;
    channel?.addEventListener('message', receiveChange);
    if (!channel) window.addEventListener('storage', onStorage);
    return () => {
      channel?.removeEventListener('message', receiveChange);
      channel?.close();
      if (channelRef.current === channel) channelRef.current = null;
      if (!channel) window.removeEventListener('storage', onStorage);
    };
  }, [enabled, refresh, userId]);

  useEffect(() => {
    if (!enabled) return;
    const reconcile = () => { if (document.visibilityState === 'visible' && navigator.onLine) void refresh(); };
    document.addEventListener('visibilitychange', reconcile);
    window.addEventListener('online', reconcile);
    return () => {
      document.removeEventListener('visibilitychange', reconcile);
      window.removeEventListener('online', reconcile);
    };
  }, [enabled, refresh]);

  useEffect(() => {
    if (session?.status !== 'RUNNING') return;
    const update = () => setNowMs(Date.now());
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, [session?.id, session?.status]);

  const runTransition = useCallback(async (action: 'pause' | 'resume' | 'finish' | 'cancel') => {
    if (!session || pendingAction) return false;
    setPendingAction(action);
    try {
      const result = await axiosClient.post<StudySessionEnvelope, StudySessionEnvelope>(`/api/study-sessions/${session.id}/${action}`, { expectedVersion: session.version });
      applyEnvelope(result);
      setError(null);
      broadcastChange();
      return true;
    } catch (requestError) {
      const failureMessage = messageFor(requestError);
      await refresh();
      setError(failureMessage);
      return false;
    } finally {
      setPendingAction(null);
    }
  }, [applyEnvelope, broadcastChange, pendingAction, refresh, session]);

  const start = useCallback(async (input: StartFocusSessionInput) => {
    if (!enabled || pendingAction) return false;
    setPendingAction('start');
    try {
      const result = await axiosClient.post<StudySessionEnvelope, StudySessionEnvelope>('/api/study-sessions', {
        ...input,
        clientMutationId: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `start-${Date.now()}`,
      });
      applyEnvelope(result);
      setError(null);
      broadcastChange();
      return true;
    } catch (requestError) {
      const failureMessage = messageFor(requestError);
      await refresh();
      setError(failureMessage);
      return false;
    } finally {
      setPendingAction(null);
    }
  }, [applyEnvelope, broadcastChange, enabled, pendingAction, refresh]);

  const elapsedMs = localElapsed(session, nowMs + clockOffsetMs);
  const remainingMs = session ? Math.max(0, session.plannedDurationMs - elapsedMs) : 0;

  useEffect(() => {
    if (!session || session.status !== 'RUNNING' || remainingMs > 0 || pendingAction || autoFinishRef.current === session.id) return;
    autoFinishRef.current = session.id;
    void runTransition('finish').finally(() => { autoFinishRef.current = null; });
  }, [pendingAction, remainingMs, runTransition, session]);

  const value = useMemo(() => ({
    session,
    elapsedMs,
    remainingMs,
    loading,
    pendingAction,
    error,
    suggestion: routeSuggestion(location.pathname),
    start,
    pause: () => runTransition('pause'),
    resume: () => runTransition('resume'),
    finish: () => runTransition('finish'),
    cancel: () => runTransition('cancel'),
    refresh,
  }), [elapsedMs, error, loading, location.pathname, pendingAction, refresh, remainingMs, runTransition, session, start]);

  return <FocusTimerContext.Provider value={value}>{children}</FocusTimerContext.Provider>;
}
