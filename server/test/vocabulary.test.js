const test = require('node:test');
const assert = require('node:assert/strict');
const { _private } = require('../src/services/vocabulary.service');

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

test('a vocabulary term requires word, English meaning, and translation', () => {
  assert.throws(
    () => _private.validateTerms([{ word: 'Infer', meaning: '', translation: 'Suy luận' }]),
    error => error.statusCode === 400 && /requires a word, meaning, and translation/.test(error.body.error),
  );
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
