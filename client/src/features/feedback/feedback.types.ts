export const feedbackLevels = {
  CRITICAL: { label: 'Critical', description: 'I cannot continue, or an essential feature is completely broken.' },
  MAJOR: { label: 'Major issue', description: 'A feature is failing and seriously disrupting my work.' },
  MINOR: { label: 'Minor annoyance', description: 'Something is confusing or inconvenient, but I can continue.' },
  IMPROVEMENT: { label: 'Improvement', description: 'I have a suggestion to make the platform better.' },
  GENERAL: { label: 'General feedback', description: 'I want to share a comment or something that works well.' },
} as const;
export type FeedbackLevel = keyof typeof feedbackLevels;
export const feedbackStatuses = { NEW: 'New', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved' } as const;
export type FeedbackStatus = keyof typeof feedbackStatuses;
export interface FeedbackImage { id: string; name: string; mimeType: string; sizeBytes: number }
export interface FeedbackReport {
  id: string;
  level: FeedbackLevel;
  status: FeedbackStatus;
  message: string;
  pagePath: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: number; name: string; email: string; role: string };
  attachments: FeedbackImage[];
}
export interface FeedbackPage { items: FeedbackReport[]; nextCursor: string | null }
export function feedbackError(error: unknown, fallback: string) {
  const data = (error as { response?: { data?: { error?: string; message?: string } } }).response?.data;
  return data?.error || data?.message || fallback;
}
