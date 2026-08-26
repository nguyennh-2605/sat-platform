import { z } from 'zod';

export const createTestDetailsSchema = (isAdmin: boolean) => z.object({
  title: z.string().trim().min(1, 'Enter a test name.'),
  subject: z.enum(['RW', 'MATH']),
  duration: z.number().int('Duration must be a whole number.').min(1, 'Duration must be at least 1 minute.'),
  moduleCount: z.number().int().min(1).max(2),
  mode: z.enum(['PRACTICE', 'EXAM']),
  category: z.enum(['PRACTICE', 'REAL']),
  testDate: z.string(),
}).superRefine((values, context) => {
  if (isAdmin && values.category === 'REAL' && !values.testDate) {
    context.addIssue({ code: 'custom', path: ['testDate'], message: 'Choose the official test date.' });
  }
});
