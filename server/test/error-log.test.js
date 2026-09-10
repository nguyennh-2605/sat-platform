const test = require('node:test');
const assert = require('node:assert/strict');
// Prisma model delegates are proxy properties; use a test-local database double.
const prismaPath = require.resolve('../src/config/prisma');
const prisma = { $transaction() {}, errorLog: { count() {}, findMany() {}, findFirst() {}, findUnique() {}, update() {} } };
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
const { _errorLogHelpers } = require('../src/services/error-log.service');
const service = require('../src/services/error-log.service');
const { sanitizeReflection, isRichTextEmpty } = require('../src/utils/error-log-rich-text');

const { buildAutomaticErrorLogRows, isReviewComplete, normalizeAnalysis, normalizeManualEntry, normalizeMarkReviewed, normalizeRequestData, normalizeSourceUrl } = _errorLogHelpers;

test('automatic error logs include only wrong answers with objective question context', () => {
  const rows = buildAutomaticErrorLogRows({
    userId: 7,
    submissionId: 42,
    test: {
      title: 'Practice Test 4',
      subject: 'RW',
      sections: [{
        order: 2,
        questions: [
          { id: 10, order: 4, correctAnswer: 'B', domainCode: 'RW_CRAFT_AND_STRUCTURE', skillCode: 'RW_WORDS_IN_CONTEXT' },
          { id: 11, order: 5, correctAnswer: 'D', domainCode: 'RW_CRAFT_AND_STRUCTURE', skillCode: 'RW_TEXT_STRUCTURE_AND_PURPOSE' },
        ],
      }],
    },
    answerRows: [
      { questionId: 10, selectedChoice: 'D', isCorrect: false },
      { questionId: 11, selectedChoice: 'D', isCorrect: true },
    ],
  });

  assert.deepEqual(rows, [{
    userId: 7,
    submissionId: 42,
    questionId: 10,
    source: 'Practice Test 4 · Module 2 · Question 4',
    category: 'Words in Context',
    userAnswer: 'D',
    correctAnswer: 'B',
  }]);
});

test('an omitted wrong answer is preserved as an explicit answer label', () => {
  const [row] = buildAutomaticErrorLogRows({
    userId: 7,
    submissionId: 42,
    test: {
      title: 'Math Practice',
      subject: 'MATH',
      sections: [{ order: 1, questions: [{ id: 20, order: 1, correctAnswer: '12', domainCode: null, skillCode: null }] }],
    },
    answerRows: [{ questionId: 20, selectedChoice: null, isCorrect: false }],
  });

  assert.equal(row.userAnswer, 'Omitted');
  assert.equal(row.category, 'General');
});

test('a review requires only both reflections; legacy diagnosis and next step are optional', () => {
  const complete = {
    whyChosen: 'I matched two words that looked similar.',
    whyWrong: 'The words have different meanings in context.',
    whyRight: 'The correct word means to cause the event.',
    takeaway: 'Predict the logical role before checking choices.',
    rootCause: 'KNOWLEDGE_GAP',
  };
  assert.equal(isReviewComplete(complete), true);
  assert.equal(isReviewComplete({ ...complete, takeaway: '', whyChosen: '' }), true);
  assert.equal(isReviewComplete({ ...complete, whyWrong: '<p><br></p>' }), false);
  assert.equal(isReviewComplete({ ...complete, rootCause: null }), true);
  assert.equal(isReviewComplete({ ...complete, whyRight: null }), false);
});

test('manual entries trim input and reject invalid root causes', () => {
  const entry = normalizeManualEntry({
    source: '  Outside worksheet  ',
    category: ' Algebra ',
    userAnswer: ' 3 ',
    correctAnswer: ' 4 ',
    whyChosen: '  I copied the coefficient. ',
  });
  assert.equal(entry.source, 'Outside worksheet');
  assert.equal(entry.whyChosen, 'I copied the coefficient.');
  assert.throws(
    () => normalizeAnalysis({ rootCause: 'OTHER' }),
    error => error.statusCode === 400 && /valid root cause/.test(error.body.message),
  );
});

test('error log commands reject malformed bodies and ambiguous review state values', () => {
  assert.throws(() => normalizeRequestData(null), error => error.statusCode === 400);
  assert.throws(() => normalizeRequestData([]), error => error.statusCode === 400);
  assert.throws(() => normalizeMarkReviewed('true'), error => error.statusCode === 400);
  assert.equal(normalizeMarkReviewed(true), true);
});

test('manual source links are optional, normalized, and limited to http or https', () => {
  assert.equal(normalizeSourceUrl(undefined), undefined);
  assert.equal(normalizeSourceUrl(''), null);
  assert.equal(normalizeSourceUrl(' https://example.com/practice?q=1 '), 'https://example.com/practice?q=1');
  assert.throws(() => normalizeSourceUrl('example.com/practice'), error => error.statusCode === 400);
  assert.throws(() => normalizeSourceUrl('javascript:alert(1)'), error => error.statusCode === 400);
  assert.throws(() => normalizeSourceUrl('ftp://example.com/file'), error => error.statusCode === 400);
  const entry = normalizeManualEntry({ source: 'External worksheet', sourceUrl: 'https://example.com/test', userAnswer: 'A', correctAnswer: 'B' });
  assert.equal(entry.source, 'External worksheet');
  assert.equal(entry.sourceUrl, 'https://example.com/test');
});

test('reflection HTML keeps semantic formatting and removes executable content and unsafe URLs', () => {
  const html = sanitizeReflection('<p onclick="evil()"><strong>Reason</strong> <u>detail</u></p><script>evil()</script><img src=x onerror=evil()><a href="javascript:evil()">bad</a><a href="https://example.com">good</a>');
  assert.match(html, /<strong>Reason<\/strong>/);
  assert.match(html, /<u>detail<\/u>/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /onclick|onerror|javascript:|<script|<img|evil\(\)/);
  for (const empty of ['<p><br></p>', '<p>&nbsp;</p>', '<p>&#160;</p>', '<p>\u200B</p>', '<script>text</script>']) {
    assert.equal(isRichTextEmpty(sanitizeReflection(empty)), true, empty);
    assert.equal(normalizeAnalysis({ whyWrong: empty }).whyWrong, null);
  }
  assert.equal(isRichTextEmpty('<p>Real reasoning</p>'), false);
  assert.throws(() => normalizeAnalysis({ whyRight: 'x'.repeat(16001) }), error => error.statusCode === 400);
});

test('cursor validation rejects malformed dates and ids', () => {
  for (const cursor of ['', 'invalid!', Buffer.from(JSON.stringify({ id: 'bad', createdAt: 'bad' })).toString('base64url')]) {
    assert.throws(() => _errorLogHelpers.decodeCursor(cursor), error => error.statusCode === 400);
  }
});

for (const size of [1000, 5000, 10000]) {
  test(`cursor traversal covers ${size} entries with tied timestamps without duplicates and without question payloads`, async t => {
    const rows = Array.from({ length: size }, (_, index) => ({ id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`, createdAt: new Date('2026-09-10T00:00:00.000Z') })).reverse();
    t.mock.method(prisma, '$transaction', async queries => Promise.all(queries));
    t.mock.method(prisma.errorLog, 'count', async () => size);
    t.mock.method(prisma.errorLog, 'findMany', async args => {
      assert.equal(args.select.question, undefined);
      assert.equal(args.select.whyChosen, undefined);
      assert.equal(args.skip, undefined);
      assert.equal(args.take, 41);
      assert.deepEqual(args.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
      const boundary = args.where.AND?.[1].OR[1].id.lt;
      const scope = args.where.AND?.[0] || args.where;
      assert.equal(scope.userId, 7);
      assert.equal(scope.rootCause, 'GUESSED');
      assert.equal(scope.OR[0].source.contains, 'Practice');
      return rows.filter(row => !boundary || row.id < boundary).slice(0, args.take);
    });
    const ids = [];
    let cursor;
    do {
      const page = await service.getErrorLogs({ userId: 7, query: { limit: 40, cursor, search: 'Practice', rootCause: 'GUESSED' } });
      ids.push(...page.items.map(row => row.id));
      cursor = page.nextCursor;
    } while (cursor);
    assert.equal(new Set(ids).size, size);
    assert.deepEqual(ids, rows.map(row => row.id));
  });
}

test('question endpoint scopes lookup to the owner and loads full context only on demand', async t => {
  t.mock.method(prisma.errorLog, 'findFirst', async args => {
    assert.deepEqual(args.where, { id: 'entry', userId: 7 });
    assert.equal(args.select.question.select.blocks, true);
    assert.equal(args.select.question.select.explanation, true);
    return null;
  });
  await assert.rejects(service.getErrorLogQuestion({ id: 'entry', userId: 7 }), error => error.statusCode === 404);
});

test('editing completion sets Reviewed automatically, clearing reflection reopens it, and ownership is enforced', async t => {
  let entry = { id: 'entry', userId: 7, questionId: 123, whyWrong: '<p>Wrong assumption</p>', whyRight: null, rootCause: null, reviewedAt: null };
  t.mock.method(prisma.errorLog, 'findUnique', async () => entry);
  t.mock.method(prisma.errorLog, 'update', async args => { entry = { ...entry, ...args.data }; return entry; });
  await assert.rejects(service.updateErrorLog({ id: 'entry', userId: 8, data: { whyRight: 'other' } }), error => error.statusCode === 403);
  await assert.rejects(service.deleteErrorLog({ id: 'entry', userId: 8 }), error => error.statusCode === 403);
  const reviewed = await service.updateErrorLog({ id: 'entry', userId: 7, data: { whyRight: '<p>Evidence</p>', source: 'Cannot change linked context' } });
  assert.ok(reviewed.reviewedAt instanceof Date);
  assert.equal(reviewed.source, undefined);
  const reopened = await service.updateErrorLog({ id: 'entry', userId: 7, data: { whyWrong: '<p><br></p>' } });
  assert.equal(reopened.reviewedAt, null);
  assert.equal(reopened.whyWrong, null);
});

test('submission synchronization uses duplicate protection', async () => {
  const db = { errorLog: { createMany: async args => { assert.equal(args.skipDuplicates, true); assert.equal(args.data.length, 1); return { count: 1 }; } } };
  assert.equal(await service.syncSubmissionErrorLogs({ db, userId: 7, submissionId: 1, test: { title: 'Test', sections: [{ questions: [{ id: 1, correctAnswer: 'A' }] }] }, answerRows: [{ questionId: 1, isCorrect: false }] }), 1);
});
