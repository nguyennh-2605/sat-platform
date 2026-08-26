import type { ContentBlock } from '@/types/quiz';

export type Subject = 'RW' | 'MATH';
export type TestMode = 'PRACTICE' | 'EXAM';
export type TestStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type IssueSeverity = 'error' | 'warning';

export interface TestDetailsValues {
  title: string;
  subject: Subject;
  duration: number;
  moduleCount: number;
  mode: TestMode;
  category: 'PRACTICE' | 'REAL';
  testDate: string;
}

export interface TaxonomySkill { code: string; name: string; sortOrder: number }
export interface TaxonomyDomain { code: string; name: string; subject: Subject; sortOrder: number; skills: TaxonomySkill[] }
export interface ImportIssue { severity: IssueSeverity; code: string; message: string }
export interface ImportChoice { id: string; text: string }
export interface ImportQuestion {
  clientId: string;
  module: number;
  order: number;
  type: 'MCQ' | 'SPR';
  blocks: ContentBlock[];
  questionText: string;
  choices: ImportChoice[];
  correctAnswer: string;
  explanation?: string;
  domainCode: string;
  skillCode: string;
  issues: ImportIssue[];
}
export interface ImportModule { order: number; name: string; questions: ImportQuestion[] }
export interface ImportPreview {
  fileName?: string;
  modules: ImportModule[];
  summary: { questionCount: number; classifiedCount: number; errorCount: number; warningCount: number };
  issues: ImportIssue[];
}
export interface ExtractedDocument { fileName: string; text: string }
export interface EditTestPayload {
  id: number;
  title: string;
  duration: number;
  subject: Subject;
  mode: TestMode;
  category: 'PRACTICE' | 'REAL';
  status: TestStatus;
  testDate?: string | null;
  folderId?: number | null;
  moduleCount: number;
  hasAttempts: boolean;
  hasUsage: boolean;
  structuredText: string;
}
