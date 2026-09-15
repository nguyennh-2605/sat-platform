import { createContext, useContext } from 'react';
import type { StartFocusSessionInput, StudyContextSuggestion, StudySession } from './focus-timer.types';

export interface FocusTimerContextValue {
  session: StudySession | null;
  elapsedMs: number;
  remainingMs: number;
  loading: boolean;
  pendingAction: string | null;
  error: string | null;
  suggestion: StudyContextSuggestion;
  start: (input: StartFocusSessionInput) => Promise<boolean>;
  pause: () => Promise<boolean>;
  resume: () => Promise<boolean>;
  finish: () => Promise<boolean>;
  cancel: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

export const FocusTimerContext = createContext<FocusTimerContextValue | null>(null);

export const useFocusTimer = () => {
  const value = useContext(FocusTimerContext);
  if (!value) throw new Error('useFocusTimer must be used inside FocusTimerProvider.');
  return value;
};
