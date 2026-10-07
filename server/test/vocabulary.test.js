const test = require('node:test');
const assert = require('node:assert/strict');

// Prisma model delegates are proxy properties; use a test-local database double.
const prismaPath = require.resolve('../src/config/prisma');
const prisma = {
  vocabularySet: {
    findUnique() {},
    delete() {},
  },
};
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };

const vocabularyService = require('../src/services/vocabulary.service');
const { _private } = vocabularyService;

test('vocabulary words are normalized for duplicate detection', () => {
  assert.equal(_private.normalizeWord('  Take   Part  '), 'take part');
  assert.throws(
    () => _private.validateTerms([
      { word: 'Analyze', meaning: 'Examine closely', translation: 'Phân tích' },
      { word: ' analyze ', meaning: 'Study', translation: 'Nghiên cứu' },
    ]),
    error => error.statusCode === 400 && /appears more than once/.test(error.body.error),
  );
});

test('a vocabulary term requires word and English meaning; translation is optional', () => {
  assert.throws(
    () => _private.validateTerms([{ word: 'Infer', meaning: '', translation: 'Suy luận' }]),
    error => error.statusCode === 400 && /requires a word and meaning/.test(error.body.error),
  );
});

test('a word can be saved without translation or original sentence', () => {
  const [term] = _private.validateTerms([{ word: 'infer', meaning: 'Draw a conclusion' }]);
  assert.equal(term.translation, '');
  assert.equal(term.exampleSentence, null);
});

test('term validation trims values, preserves an optional sentence, and assigns stable order', () => {
  const [term] = _private.validateTerms([{
    word: '  coherent ',
    meaning: ' logical and consistent ',
    translation: ' mạch lạc ',
    exampleSentence: ' The argument is coherent. ',
  }]);
  assert.deepEqual(term, {
    word: 'coherent',
    normalizedWord: 'coherent',
    meaning: 'logical and consistent',
    translation: 'mạch lạc',
    exampleSentence: 'The argument is coherent.',
    order: 0,
  });
});

test('term validation preserves an existing term id while editing', () => {
  const [term] = _private.validateTerms([{
    id: 'term-123',
    word: 'coherent',
    meaning: 'logical and consistent',
    translation: 'mạch lạc',
  }]);
  assert.equal(term.id, 'term-123');
});

test('quiz shuffling returns a new array without losing options', () => {
  const source = ['a', 'b', 'c', 'd'];
  const shuffled = _private.shuffle(source);
  assert.notEqual(shuffled, source);
  assert.deepEqual([...shuffled].sort(), source);
  assert.deepEqual(source, ['a', 'b', 'c', 'd']);
});

test('study ranges keep the original one-based word order', () => {
  const source = ['one', 'two', 'three', 'four', 'five'];
  assert.deepEqual(_private.rangeSourceItems(source, 2, 4), {
    items: ['two', 'three', 'four'],
    rangeStart: 2,
    rangeEnd: 4,
  });
  assert.deepEqual(source, ['one', 'two', 'three', 'four', 'five']);
});

test('study ranges clamp the end and reject a start after the final word', () => {
  assert.deepEqual(_private.rangeSourceItems(['one', 'two', 'three'], 2, 99), {
    items: ['two', 'three'],
    rangeStart: 2,
    rangeEnd: 3,
  });
  assert.throws(
    () => _private.rangeSourceItems(['one', 'two'], 3, 4),
    error => error.statusCode === 400 && /starts after the final word/.test(error.body.error),
  );
});

test('an explicit review queue keeps source order and rejects foreign terms', () => {
  const items = [
    { id: 'term-1', word: 'one' },
    { id: 'term-2', word: 'two' },
    { id: 'term-3', word: 'three' },
  ];
  assert.deepEqual(_private.selectSourceItemsById(items, ['term-3', 'term-1']), [items[0], items[2]]);
  assert.throws(
    () => _private.selectSourceItemsById(items, ['term-1', 'foreign-term']),
    error => error.statusCode === 400 && /selected study words are invalid/.test(error.body.error),
  );
});

test('a wrong quiz answer immediately returns a mastered word to learning', () => {
  assert.deepEqual(_private.nextTermMastery({
    existing: { mastery: 'MASTERED', correctStreak: 8 },
    correct: false,
    mode: 'QUIZ',
  }), { mastery: 'LEARNING', correctStreak: 0 });
});

test('two consecutive quiz answers are required to master a learning word', () => {
  const first = _private.nextTermMastery({ existing: { mastery: 'LEARNING', correctStreak: 0 }, correct: true, mode: 'QUIZ' });
  const second = _private.nextTermMastery({ existing: { mastery: first.mastery, correctStreak: first.correctStreak }, correct: true, mode: 'QUIZ' });
  assert.deepEqual(first, { mastery: 'LEARNING', correctStreak: 1 });
  assert.deepEqual(second, { mastery: 'MASTERED', correctStreak: 2 });
});

test('flashcard self-rating cannot promote a learning word to mastered', () => {
  assert.deepEqual(_private.nextTermMastery({
    existing: { mastery: 'LEARNING', correctStreak: 1 },
    correct: true,
    mode: 'FLASHCARD',
  }), { mastery: 'LEARNING', correctStreak: 1 });
});

test('administrators can delete system vocabulary sets', () => {
  assert.equal(_private.canDeleteSet({ scope: 'SYSTEM', ownerId: null }, 7, 'ADMIN'), true);
  assert.equal(_private.canDeleteSet({ scope: 'SYSTEM', ownerId: null }, 7, 'TEACHER'), false);
  assert.equal(_private.canDeleteSet({ scope: 'SYSTEM', ownerId: null }, 7, 'STUDENT'), false);
});

test('personal vocabulary sets can only be deleted by their owner or an administrator', () => {
  const set = { scope: 'PERSONAL', ownerId: 7 };
  assert.equal(_private.canDeleteSet(set, 7, 'TEACHER'), true);
  assert.equal(_private.canDeleteSet(set, 8, 'TEACHER'), false);
  assert.equal(_private.canDeleteSet(set, 8, 'ADMIN'), true);
});

test('an administrator can delete an unused system vocabulary set', async t => {
  let deletedId = null;
  t.mock.method(prisma.vocabularySet, 'findUnique', async () => ({
    id: 'system-set',
    scope: 'SYSTEM',
    ownerId: null,
    _count: { activities: 0 },
  }));
  t.mock.method(prisma.vocabularySet, 'delete', async ({ where }) => { deletedId = where.id; });

  assert.deepEqual(await vocabularyService.deleteSet({ setId: 'system-set', userId: 7, userRole: 'ADMIN' }), { deleted: true });
  assert.equal(deletedId, 'system-set');
});

test('a non-admin cannot delete a system vocabulary set', async t => {
  let deleteCalled = false;
  t.mock.method(prisma.vocabularySet, 'findUnique', async () => ({
    id: 'system-set',
    scope: 'SYSTEM',
    ownerId: null,
    _count: { activities: 0 },
  }));
  t.mock.method(prisma.vocabularySet, 'delete', async () => { deleteCalled = true; });

  await assert.rejects(
    vocabularyService.deleteSet({ setId: 'system-set', userId: 7, userRole: 'TEACHER' }),
    error => error.statusCode === 403 && /permission/.test(error.body.error),
  );
  assert.equal(deleteCalled, false);
});
