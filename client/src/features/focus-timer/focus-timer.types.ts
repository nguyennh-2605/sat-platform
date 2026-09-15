export type StudySessionStatus = 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export type StudyActivityType = 'PRACTICE' | 'VOCABULARY' | 'ERROR_LOG' | 'HOMEWORK' | 'OTHER';
export type StudyResourceType = 'TEST' | 'VOCABULARY_SET' | 'ASSIGNMENT';

export interface StudySession {
  id: string;
  status: StudySessionStatus;
  source: 'FOCUS_CLOCK';
  activityType: StudyActivityType;
  resourceType: StudyResourceType | null;
  resourceId: string | null;
  label: string | null;
  plannedDurationMs: number;
  accumulatedMs: number;
  startedAt: string;
  lastResumedAt: string | null;
  endedAt: string | null;
  version: number;
  elapsedMs: number;
  remainingMs: number;
}

export interface StudySessionEnvelope {
  session: StudySession | null;
  serverNow: string;
}

export interface StudyContextSuggestion {
  activityType: StudyActivityType;
  resourceType?: StudyResourceType;
  resourceId?: string;
  label: string;
}

export interface StartFocusSessionInput extends StudyContextSuggestion {
  plannedDurationMs: number;
}
