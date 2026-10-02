import type { BankQuestion, BankQuestionPage } from '@/features/question-bank/question-bank.types';

export interface RoadmapSkill { code: string; name: string; domain?: { code: string; name: string; subject: 'RW' | 'MATH' } }
export interface RoadmapMilestone {
  id: string;
  title: string;
  description: string | null;
  order: number;
  theoryBlocks: Array<{ type: 'text'; content: string }>;
  requiredQuestionCount: number;
  answeredCount?: number;
  theoryConfirmedAt?: string | null;
  completedAt?: string | null;
  locked?: boolean;
  skillCodes?: string[];
  skills: RoadmapSkill[];
}
export interface Roadmap {
  id: string;
  title: string;
  description: string | null;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  milestones: RoadmapMilestone[];
}
export interface MilestoneQuestionPage extends BankQuestionPage { items: BankQuestion[] }
