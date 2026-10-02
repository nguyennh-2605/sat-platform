const test = require('node:test');
const assert = require('node:assert/strict');
const sonderSatVocabulary = require('../prisma/data/sonder-sat-vocabulary.json');

test('Sonder SAT vocabulary seed is complete and valid', () => {
  assert.equal(sonderSatVocabulary.sourceTermCount, 991);
  assert.equal(sonderSatVocabulary.terms.length, sonderSatVocabulary.sourceTermCount);

  const normalizedWords = new Set();
  sonderSatVocabulary.terms.forEach((term, index) => {
    assert.ok(term.word.trim(), `Term ${index + 1} requires a word.`);
    assert.ok(term.meaning.trim(), `${term.word} requires a meaning.`);
    assert.ok(term.translation.trim(), `${term.word} requires a translation.`);
    assert.ok(term.exampleSentence.trim(), `${term.word} requires an example sentence.`);
    assert.ok(term.word.length <= 100, `${term.word} exceeds the word limit.`);
    assert.ok(term.meaning.length <= 500, `${term.word} exceeds the meaning limit.`);
    assert.ok(term.translation.length <= 300, `${term.word} exceeds the translation limit.`);
    assert.ok(term.exampleSentence.length <= 500, `${term.word} exceeds the example limit.`);

    const normalizedWord = term.word.toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
    assert.ok(!normalizedWords.has(normalizedWord), `${term.word} appears more than once.`);
    normalizedWords.add(normalizedWord);
  });
});
