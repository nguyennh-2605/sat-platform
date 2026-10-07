const test = require('node:test');
const assert = require('node:assert/strict');
const { scheduleProgress } = require('../src/services/vocabulary-scheduler.service');
const { createPracticeService, _private } = require('../src/services/vocabulary-practice.service');
const { _private: { sessionResponse } } = require('../src/services/vocabulary.service');
const now = new Date('2026-10-07T00:00:00Z');

test('FSRS starts from real answers, graduates learning, and relearns forgotten words', () => {
  const first = scheduleProgress({ seenCount: 100, mastery: 'MASTERED' }, true, now);
  assert.equal(first.log.rating, 3);
  assert.equal(first.log.previousState.reps, 0);
  assert.equal(first.data.fsrsReps, 1);
  assert.equal(first.data.mastery, 'LEARNING');
  assert.equal(first.data.dueAt - now, 10 * 60000);
  const second = scheduleProgress(first.data, true, first.data.dueAt);
  assert.equal(second.data.fsrsState, 2);
  assert.equal(second.data.mastery, 'MASTERED');
  assert.ok(second.data.dueAt - first.data.dueAt >= 86400000);
  const forgot = scheduleProgress(second.data, false, second.data.dueAt);
  assert.equal(forgot.log.rating, 1);
  assert.equal(forgot.data.mastery, 'LEARNING');
  assert.equal(forgot.data.fsrsLapses, 1);
  assert.ok(forgot.data.dueAt > second.data.dueAt);
  assert.equal(forgot.data.fsrsReps, 3);
  assert.equal(forgot.log.previousState.last_review, first.data.dueAt.toISOString());
});

test('daily quiz hides the correct meaning until answered, while recall cards can reveal it', () => {
  const question = { id: 'q', prompt: 'infer', correctMeaning: 'Draw a conclusion', options: ['Draw a conclusion', 'Other'], reviewLog: null };
  const session = { isDaily: true, mode: 'QUIZ', status: 'IN_PROGRESS', totalItems: 1, questions: [question] };
  assert.equal(sessionResponse(session).questions[0].meaning, undefined);
  assert.equal(sessionResponse({ ...session, questions: [{ ...question, options: [] }] }).questions[0].meaning, question.correctMeaning);
  assert.equal(sessionResponse({ ...session, questions: [{ ...question, answeredAt: now, reviewLog: { nextDueAt: now } }] }).questions[0].nextDueAt, now);
});

test('practice timezone counts use the learner date and reject invalid timezones', () => {
  assert.equal(_private.localDate(new Date('2026-10-06T18:00:00Z'), 'Asia/Ho_Chi_Minh'), '2026-10-07');
  assert.throws(() => _private.validateTimezone('invalid/timezone'), error => error.statusCode === 400);
  assert.deepEqual(_private.termAccess(10).set.OR, [{ scope: 'SYSTEM', status: 'PUBLISHED' }, { scope: 'PERSONAL', ownerId: 10 }]);
});

test('daily practice resumes a persisted session without selecting new words', async () => {
  const tx = { $executeRaw: async () => 1, vocabularyStudySession: { findFirst: async () => ({ id: 'saved', totalItems: 1, questions: [] }) } };
  const service = createPracticeService({ db: { $transaction: callback => callback(tx) } });
  assert.equal((await service.startDaily({ userId: 10 })).id, 'saved');
  await assert.rejects(service.startDaily({ userId: 10, focus: 'ALL' }), error => error.statusCode === 400);
});

test('a small due collection falls back to recall; new words always use recall', async () => {
  const dueTerm = { id: 'due', setId: 'mine', word: 'infer', meaning: 'Draw a conclusion', translation: '', exampleSentence: 'Never copy this sentence' };
  const fresh = { ...dueTerm, id: 'new', word: 'deduce' };
  let created;
  const tx = {
    $executeRaw: async () => 1,
    vocabularyStudySession: { findFirst: async () => null, create: async ({ data }) => { created = data; return { ...data, questions: data.questions.create }; } },
    vocabularyTermProgress: { findMany: async query => { assert.equal(query.where.userId, 10); assert.equal(query.take, 20); return [{ term: dueTerm }]; } },
    vocabularyTerm: { findMany: async query => query.select ? [{ meaning: dueTerm.meaning }] : [fresh] },
  };
  await createPracticeService({ db: { $transaction: callback => callback(tx) }, clock: () => now }).startDaily({ userId: 10 });
  assert.equal(created.setId, null);
  assert.equal(created.isDaily, true);
  assert.deepEqual(created.questions.create.map(q => q.options), [[], []]);
  assert.ok(created.questions.create.every(q => q.exampleSentence === null));
});

test('due words receive automatically generated choices when four distinct meanings exist', async () => {
  const term = { id: 'due', setId: 'mine', word: 'infer', meaning: 'Draw a conclusion', translation: '' };
  let created;
  const tx = { $executeRaw: async () => 1,
    vocabularyStudySession: { findFirst: async () => null, create: async ({ data }) => { created = data; return { ...data, questions: data.questions.create }; } },
    vocabularyTermProgress: { findMany: async () => [{ term }] },
    vocabularyTerm: { findMany: async () => ['Draw a conclusion', 'Be brief', 'Be careful', 'Support'].map(meaning => ({ meaning })) },
  };
  await createPracticeService({ db: { $transaction: callback => callback(tx) } }).startDaily({ userId: 10, focus: 'REVIEW' });
  assert.equal(created.questions.create[0].options.length, 4);
  assert.ok(created.questions.create[0].options.includes(term.meaning));
});

test('saving a word uses a curated definition and never copies its original sentence', async () => {
  let stored;
  const tx = { $executeRaw: async () => 1, $queryRaw: async () => [],
    vocabularySet: { upsert: async () => ({ id: 'mine', title: 'Saved words' }), update: async () => ({}) },
    vocabularyTerm: { findUnique: async () => null, findFirst: async () => ({ order: 4 }), create: async ({ data }) => { stored = data; return { id: 'saved', ...data }; } },
  };
  const db = { $transaction: callback => callback(tx), vocabularySet: { findFirst: async () => null }, vocabularyTerm: { findFirst: async () => ({ meaning: 'Draw a conclusion', translation: '', exampleSentence: 'Original source sentence' }) } };
  const service = createPracticeService({ db, dictionary: () => { throw new Error('No external lookup needed'); } });
  const result = await service.saveWord({ userId: 10, word: 'Infer', exampleSentence: 'Injected', sourceUrl: 'https://example.com' });
  assert.equal(result.created, true);
  assert.equal(stored.exampleSentence, null);
  assert.equal(stored.sourceUrl, undefined);
  assert.equal(stored.order, 5);
  tx.vocabularyTerm.findUnique = async () => ({ id: 'saved', word: 'infer' });
  assert.equal((await service.saveWord({ userId: 10, word: 'infer' })).created, false);
});

test('saving into another user collection is rejected; undo protects words already studied', async () => {
  const tx = { $executeRaw: async () => 1, vocabularySet: { findFirst: async query => { assert.equal(query.where.ownerId, 10); return null; } }, vocabularyTerm: { findFirst: async () => ({ id: 'word', _count: { progress: 1, sessionQuestions: 0 } }) } };
  const db = { $transaction: callback => callback(tx), vocabularySet: tx.vocabularySet, vocabularyTerm: { findFirst: async () => ({ meaning: 'Meaning' }) } };
  const service = createPracticeService({ db });
  await assert.rejects(service.saveWord({ userId: 10, word: 'word', setId: 'someone-else' }), error => error.statusCode === 404);
  await assert.rejects(service.undoSave({ userId: 10, termId: 'word' }), error => error.statusCode === 409);
});

test('an existing saved word does not depend on the dictionary being available', async () => {
  const db = { vocabularySet: { findFirst: async query => { assert.equal(query.where.ownerId, 10); return { id: 'mine', title: 'Saved words', status: 'PUBLISHED' }; } }, vocabularyTerm: { findUnique: async () => ({ id: 'existing', word: 'infer' }) } };
  const service = createPracticeService({ db, dictionary: () => { throw new Error('Provider unavailable'); } });
  assert.deepEqual(await service.saveWord({ userId: 10, word: 'infer' }), { termId: 'existing', setId: 'mine', setTitle: 'Saved words', word: 'infer', created: false });
});
