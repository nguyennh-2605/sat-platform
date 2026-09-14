const test = require('node:test');
const assert = require('node:assert/strict');

// Prisma model delegates are proxy properties; use a test-local database double.
const prismaPath = require.resolve('../src/config/prisma');
const prisma = {
  $transaction() {},
  errorLog: {
    count() {},
    create() {},
    deleteMany() {},
    findFirst() {},
    findMany() {},
    updateMany() {},
  },
};
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };

const service = require('../src/services/error-log.service');
const { _errorLogHelpers } = service;
const { sanitizeReflection, isRichTextEmpty } = require('../src/utils/error-log-rich-text');

const {
  buildAutomaticErrorLogRows,
  buildSearchText,
  decodeCursor,
  encodeCursor,
  findDeprecatedWriteFields,
  isReviewComplete,
  normalizeAnalysis,
  normalizeClientMutationId,
  normalizeExpectedVersion,
  normalizeManualEntry,
  normalizeQuestionForClient,
  normalizeRequestData,
  normalizeSourceUrl,
} = _errorLogHelpers;

const UUID_A = '00000000-0000-4000-8000-000000000001';
const UUID_B = '00000000-0000-4000-8000-000000000002';

const automaticFixture = () => ({
  userId: 7,
  submissionId: 42,
  test: {
    title: 'Practice Test 4',
    subject: 'RW',
    sections: [{
      name: 'Module 2',
      order: 2,
      questions: [
        {
          id: 10,
          type: 'MCQ',
          order: 4,
          blocks: [{ type: 'text', content: 'A short passage.' }],
          questionText: 'Which choice is most precise?',
          choices: ['A', 'B', 'C', 'D'],
          correctAnswer: 'B',
          explanation: 'B fits the context.',
          domainCode: 'RW_CRAFT_AND_STRUCTURE',
          skillCode: 'RW_WORDS_IN_CONTEXT',
        },
        {
          id: 11,
          type: 'MCQ',
          order: 5,
          blocks: [],
          questionText: 'What is the purpose?',
          choices: ['A', 'B', 'C', 'D'],
          correctAnswer: 'D',
          explanation: null,
          domainCode: 'RW_CRAFT_AND_STRUCTURE',
          skillCode: 'RW_TEXT_STRUCTURE_AND_PURPOSE',
        },
      ],
    }],
  },
  answerRows: [
    { questionId: 10, selectedChoice: 'D', isCorrect: false },
    { questionId: 11, selectedChoice: 'D', isCorrect: true },
  ],
});

test('automatic error logs persist immutable question context and searchable objective data', () => {
  const rows = buildAutomaticErrorLogRows(automaticFixture());

  assert.deepEqual(rows, [{
    userId: 7,
    submissionId: 42,
    questionId: 10,
    origin: 'SYSTEM_QUESTION',
    source: 'Practice Test 4 · Module 2 · Question 4',
    category: 'Words in Context',
    userAnswer: 'D',
    correctAnswer: 'B',
    questionSnapshot: {
      type: 'MCQ',
      blocks: [{ type: 'text', content: 'A short passage.' }],
      questionText: 'Which choice is most precise?',
      choices: [
        { id: 'A', text: 'A' },
        { id: 'B', text: 'B' },
        { id: 'C', text: 'C' },
        { id: 'D', text: 'D' },
      ],
      explanation: 'B fits the context.',
      order: 4,
      section: {
        name: 'Module 2',
        order: 2,
        test: { title: 'Practice Test 4', subject: 'RW' },
      },
    },
    searchText: 'Practice Test 4 · Module 2 · Question 4 Words in Context',
  }]);
});

test('an omitted wrong answer is preserved and automatic rows declare their origin', () => {
  const [row] = buildAutomaticErrorLogRows({
    userId: 7,
    submissionId: 42,
    test: {
      title: 'Math Practice',
      subject: 'MATH',
      sections: [{ name: 'Module 1', order: 1, questions: [{
        id: 20,
        type: 'SPR',
        order: 1,
        blocks: [],
        questionText: 'Enter a number.',
        choices: [],
        explanation: null,
        correctAnswer: '12',
        domainCode: null,
        skillCode: null,
      }] }],
    },
    answerRows: [{ questionId: 20, selectedChoice: null, isCorrect: false }],
  });

  assert.equal(row.origin, 'SYSTEM_QUESTION');
  assert.equal(row.userAnswer, 'Omitted');
  assert.equal(row.category, 'General');
  assert.equal(row.questionSnapshot.questionText, 'Enter a number.');
});

test('legacy or partial question snapshots are normalized to a safe client shape', () => {
  assert.deepEqual(normalizeQuestionForClient({
    questionText: 'Which answer is supported?',
    choices: ['First', { content: 'Second' }],
  }), {
    questionText: 'Which answer is supported?',
    choices: [
      { id: 'A', text: 'First' },
      { id: 'B', text: 'Second' },
    ],
    type: 'MCQ',
    blocks: [],
    explanation: null,
    order: 1,
    section: {
      name: '',
      order: 1,
      test: { title: '', subject: 'RW' },
    },
  });
  assert.equal(normalizeQuestionForClient(null), null);
});

test('review status is derived only from the two current reflection fields', () => {
  const complete = {
    whyWrong: '<p>The words have different meanings in context.</p>',
    whyRight: '<p>The correct word causes the event.</p>',
  };
  assert.equal(isReviewComplete(complete), true);
  assert.equal(isReviewComplete({ ...complete, whyWrong: '<p><br></p>' }), false);
  assert.equal(isReviewComplete({ ...complete, whyRight: null }), false);
  assert.equal(isReviewComplete({ ...complete, rootCause: null, takeaway: null }), true);
});

test('manual normalization creates searchable plain text without executable markup', () => {
  const entry = normalizeManualEntry({
    source: '  Outside worksheet  ',
    category: ' Algebra ',
    userAnswer: ' 3 ',
    correctAnswer: ' 4 ',
    whyWrong: '<p>I copied the <strong>coefficient</strong>.</p>',
    whyRight: '<p>Substitute first.</p>',
  });

  assert.equal(entry.source, 'Outside worksheet');
  assert.equal(entry.category, 'Algebra');
  assert.equal(entry.whyWrong, '<p>I copied the <strong>coefficient</strong>.</p>');
  assert.equal(
    buildSearchText(entry),
    'Outside worksheet Algebra I copied the coefficient. Substitute first.',
  );
  assert.doesNotMatch(buildSearchText(entry), /<[^>]+>/);
});

test('deprecated review controls and diagnosis fields are detected but ignored during rolling deployment', async t => {
  assert.deepEqual(
    findDeprecatedWriteFields({ markReviewed: false, whyChosen: 'legacy', takeaway: null, rootCause: 'GUESSED' }),
    ['markReviewed', 'whyChosen', 'takeaway', 'rootCause'],
  );
  const existing = {
    id: UUID_A,
    userId: 7,
    origin: 'MANUAL',
    source: 'Worksheet',
    whyWrong: '<p>Reason</p>',
    whyRight: '<p>Evidence</p>',
    reviewedAt: new Date(),
    version: 2,
  };
  let updateCalled = false;
  t.mock.method(prisma, '$transaction', async callback => callback({
    errorLog: {
      findFirst: async () => existing,
      updateMany: async () => { updateCalled = true; return { count: 1 }; },
    },
  }));
  const result = await service.updateErrorLog({ id: UUID_A, userId: 7, data: { markReviewed: false } });
  assert.equal(result.reviewedAt, existing.reviewedAt);
  assert.equal(result.version, 2);
  assert.equal(updateCalled, false);
});

test('request, mutation id, and optimistic version validators reject ambiguous values', () => {
  assert.throws(() => normalizeRequestData(null), error => error.statusCode === 400);
  assert.throws(() => normalizeRequestData([]), error => error.statusCode === 400);
  assert.equal(normalizeExpectedVersion(undefined), undefined);
  assert.equal(normalizeExpectedVersion(3), 3);
  for (const value of ['3', 0, -1, 1.5]) {
    assert.throws(() => normalizeExpectedVersion(value), error => error.statusCode === 400);
  }
  assert.equal(normalizeClientMutationId('manual:device-1.42'), 'manual:device-1.42');
  assert.equal(normalizeClientMutationId(''), null);
  assert.throws(() => normalizeClientMutationId('contains a space'), error => error.statusCode === 400);
  assert.throws(() => normalizeClientMutationId('x'.repeat(101)), error => error.statusCode === 400);
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

test('filter facets return status counts independent of the selected status and owner-scoped categories', async t => {
  const countCalls = [];
  let categoryQuery;
  t.mock.method(prisma.errorLog, 'count', options => {
    countCalls.push(options);
    return options;
  });
  t.mock.method(prisma.errorLog, 'findMany', options => {
    categoryQuery = options;
    return options;
  });
  t.mock.method(prisma, '$transaction', async () => [12, 7, [
    { category: 'Algebra' },
    { category: 'Words in Context' },
  ]]);

  const facets = await service.getErrorLogFacets({
    userId: 7,
    query: { search: 'coefficient', category: 'Algebra', status: 'REVIEWED' },
  });

  assert.deepEqual(facets, {
    all: 12,
    needsReview: 7,
    reviewed: 5,
    categories: ['Algebra', 'Words in Context'],
  });
  assert.deepEqual(countCalls[0], { where: {
    userId: 7,
    category: 'Algebra',
    searchText: { contains: 'coefficient', mode: 'insensitive' },
  } });
  assert.deepEqual(countCalls[1], { where: { AND: [countCalls[0].where, { reviewedAt: null }] } });
  assert.deepEqual(categoryQuery, {
    where: { userId: 7 },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  });
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

test('cursor encoding round-trips a canonical UUID and rejects non-UUID boundaries', () => {
  const createdAt = new Date('2026-09-10T00:00:00.000Z');
  assert.deepEqual(decodeCursor(encodeCursor({ id: UUID_A, createdAt })), { id: UUID_A, createdAt });

  const invalidCursors = [
    '',
    'invalid!',
    Buffer.from(JSON.stringify({ id: 'entry', createdAt: createdAt.toISOString() })).toString('base64url'),
    Buffer.from(JSON.stringify({ id: UUID_A, createdAt: 'not-a-date' })).toString('base64url'),
    Buffer.from(JSON.stringify({ id: 1, createdAt: createdAt.toISOString() })).toString('base64url'),
  ];
  for (const cursor of invalidCursors) {
    assert.throws(() => decodeCursor(cursor), error => error.statusCode === 400);
  }
});

for (const size of [1000, 5000, 10000]) {
  test(`cursor traversal covers ${size} tied rows, counts only page one, and never loads snapshots`, async t => {
    const rows = Array.from({ length: size }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      createdAt: new Date('2026-09-10T00:00:00.000Z'),
    })).reverse();
    let countCalls = 0;
    let transactionCalls = 0;
    t.mock.method(prisma, '$transaction', async queries => {
      transactionCalls += 1;
      return Promise.all(queries);
    });
    t.mock.method(prisma.errorLog, 'count', async () => {
      countCalls += 1;
      return size;
    });
    t.mock.method(prisma.errorLog, 'findMany', async args => {
      assert.equal(args.select.question, undefined);
      assert.equal(args.select.questionSnapshot, undefined);
      assert.equal(args.select.searchText, undefined);
      assert.equal(args.skip, undefined);
      assert.equal(args.take, 41);
      assert.deepEqual(args.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
      const scope = args.where.AND?.[0] || args.where;
      const boundary = args.where.AND?.[1]?.OR?.[1]?.id?.lt;
      assert.equal(scope.userId, 7);
      assert.deepEqual(scope.searchText, { contains: 'Practice', mode: 'insensitive' });
      assert.equal(scope.rootCause, undefined);
      assert.equal(scope.OR, undefined);
      return rows.filter(row => !boundary || row.id < boundary).slice(0, args.take);
    });

    const ids = [];
    let cursor;
    let pageNumber = 0;
    do {
      const page = await service.getErrorLogs({ userId: 7, query: { limit: 40, cursor, search: 'Practice', rootCause: 'GUESSED' } });
      if (pageNumber === 0) {
        assert.equal(page.total, size);
        assert.equal(page.needsReview, size);
      } else {
        assert.equal(Object.hasOwn(page, 'total'), false);
        assert.equal(Object.hasOwn(page, 'needsReview'), false);
      }
      ids.push(...page.items.map(row => row.id));
      cursor = page.nextCursor;
      pageNumber += 1;
    } while (cursor);

    assert.equal(new Set(ids).size, size);
    assert.deepEqual(ids, rows.map(row => row.id));
    assert.equal(countCalls, 2);
    assert.equal(transactionCalls, 1);
  });
}

test('legacy offset pagination uses deterministic createdAt/id ordering', async t => {
  t.mock.method(prisma, '$transaction', async queries => Promise.all(queries));
  t.mock.method(prisma.errorLog, 'count', async args => {
    assert.deepEqual(args.where, { userId: 7, reviewedAt: { not: null } });
    return 51;
  });
  t.mock.method(prisma.errorLog, 'findMany', async args => {
    assert.deepEqual(args.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
    assert.equal(args.skip, 25);
    assert.equal(args.take, 25);
    return [{ id: UUID_A }];
  });

  const result = await service.getErrorLogs({
    userId: 7,
    query: { page: 2, pageSize: 25, status: 'REVIEWED' },
  });
  assert.deepEqual(result.items, [{ id: UUID_A }]);
  assert.equal(result.pagination.total, 51);
  assert.equal(result.pagination.page, 2);
});

test('question lookup is owner-scoped and prefers the immutable snapshot', async t => {
  const snapshot = { questionText: 'Snapshot question', choices: ['Alpha', { id: 'custom', text: 'Beta' }] };
  let call = 0;
  t.mock.method(prisma.errorLog, 'findFirst', async args => {
    call += 1;
    assert.deepEqual(args.where, { id: UUID_A, userId: 7 });
    assert.equal(args.select.questionSnapshot, true);
    assert.equal(args.select.question.select.blocks, true);
    assert.equal(args.select.question.select.explanation, true);
    return call === 1
      ? { questionSnapshot: snapshot, question: { questionText: 'Edited source question' } }
      : null;
  });

  assert.deepEqual(
    await service.getErrorLogQuestion({ id: UUID_A, userId: 7 }),
    { question: {
      questionText: 'Snapshot question',
      choices: [{ id: 'A', text: 'Alpha' }, { id: 'custom', text: 'Beta' }],
      type: 'MCQ',
      blocks: [],
      explanation: null,
      order: 1,
      section: { name: '', order: 1, test: { title: '', subject: 'RW' } },
    } },
  );
  await assert.rejects(
    service.getErrorLogQuestion({ id: UUID_A, userId: 7 }),
    error => error.statusCode === 404,
  );
});

test('a concurrent disjoint edit retries its CAS and derives Reviewed from the merged row', async t => {
  let entry = {
    id: UUID_A,
    userId: 7,
    origin: 'MANUAL',
    source: 'Worksheet',
    sourceUrl: null,
    category: 'Algebra',
    userAnswer: 'A',
    correctAnswer: 'B',
    whyWrong: null,
    whyRight: null,
    reviewedAt: null,
    version: 1,
    createdAt: new Date('2026-09-10T00:00:00.000Z'),
    updatedAt: new Date('2026-09-10T00:00:00.000Z'),
    submissionId: null,
    questionId: null,
  };
  let transactionCalls = 0;
  const casVersions = [];

  t.mock.method(prisma, '$transaction', async callback => {
    transactionCalls += 1;
    const tx = {
      errorLog: {
        findFirst: async args => {
          assert.deepEqual(args.where, { id: UUID_A, userId: 7 });
          return { ...entry };
        },
        updateMany: async args => {
          casVersions.push(args.where.version);
          assert.equal(args.where.id, UUID_A);
          assert.equal(args.where.userId, 7);
          assert.deepEqual(args.data.version, { increment: 1 });
          if (transactionCalls === 1) {
            // A different tab wins with the other reflection after this transaction read.
            entry = { ...entry, whyWrong: '<p>Competing explanation</p>', version: 2 };
            return { count: 0 };
          }
          entry = {
            ...entry,
            ...args.data,
            version: entry.version + 1,
            updatedAt: new Date(),
          };
          return { count: 1 };
        },
      },
    };
    return callback(tx);
  });

  const result = await service.updateErrorLog({
    id: UUID_A,
    userId: 7,
    data: { whyRight: '<p>Requested evidence</p>' },
  });

  assert.equal(transactionCalls, 2);
  assert.deepEqual(casVersions, [1, 2]);
  assert.equal(result.version, 3);
  assert.equal(result.whyWrong, '<p>Competing explanation</p>');
  assert.equal(result.whyRight, '<p>Requested evidence</p>');
  assert.ok(result.reviewedAt instanceof Date);
  assert.match(result.searchText, /Competing explanation Requested evidence/);
});

test('an explicit stale version returns a 409 with the current public row', async t => {
  const current = {
    id: UUID_A,
    userId: 7,
    origin: 'MANUAL',
    source: 'Latest source',
    whyWrong: '<p>Latest explanation</p>',
    whyRight: null,
    reviewedAt: null,
    version: 4,
  };
  let updateCalled = false;
  t.mock.method(prisma, '$transaction', async callback => callback({
    errorLog: {
      findFirst: async args => {
        assert.deepEqual(args.where, { id: UUID_A, userId: 7 });
        return current;
      },
      updateMany: async () => {
        updateCalled = true;
        return { count: 1 };
      },
    },
  }));

  await assert.rejects(
    service.updateErrorLog({ id: UUID_A, userId: 7, data: { expectedVersion: 3, whyRight: '<p>Stale</p>' } }),
    error => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.body.current.version, 4);
      assert.equal(error.body.current.source, 'Latest source');
      assert.equal(Object.hasOwn(error.body.current, 'userId'), false);
      return true;
    },
  );
  assert.equal(updateCalled, false);
});

test('a CAS loss with an expected version reports the winner instead of retrying', async t => {
  const initial = {
    id: UUID_A,
    userId: 7,
    origin: 'MANUAL',
    source: 'Worksheet',
    category: 'Algebra',
    userAnswer: 'A',
    correctAnswer: 'B',
    whyWrong: null,
    whyRight: null,
    reviewedAt: null,
    version: 1,
  };
  const winner = { ...initial, whyWrong: '<p>Winner</p>', version: 2 };
  let transactionCalls = 0;
  t.mock.method(prisma, '$transaction', async callback => {
    transactionCalls += 1;
    return callback({
      errorLog: {
        findFirst: async () => initial,
        updateMany: async args => {
          assert.deepEqual(args.where, { id: UUID_A, userId: 7, version: 1 });
          return { count: 0 };
        },
      },
    });
  });
  t.mock.method(prisma.errorLog, 'findFirst', async args => {
    assert.deepEqual(args.where, { id: UUID_A, userId: 7 });
    return winner;
  });

  await assert.rejects(
    service.updateErrorLog({ id: UUID_A, userId: 7, data: { expectedVersion: 1, whyRight: '<p>Loser</p>' } }),
    error => error.statusCode === 409 && error.body.current.version === 2,
  );
  assert.equal(transactionCalls, 1);
});

test('delete is a single owner-scoped command and does not reveal another user row', async t => {
  const calls = [];
  t.mock.method(prisma.errorLog, 'deleteMany', async args => {
    calls.push(args);
    return { count: args.where.id === UUID_A ? 1 : 0 };
  });

  assert.equal(await service.deleteErrorLog({ id: UUID_A, userId: 7 }), undefined);
  await assert.rejects(
    service.deleteErrorLog({ id: UUID_B, userId: 7 }),
    error => error.statusCode === 404,
  );
  assert.deepEqual(calls, [
    { where: { id: UUID_A, userId: 7 } },
    { where: { id: UUID_B, userId: 7 } },
  ]);
});

test('manual create is idempotent per user and client mutation id', async t => {
  let persisted;
  let createCalls = 0;
  t.mock.method(prisma.errorLog, 'create', async args => {
    createCalls += 1;
    assert.equal(args.data.origin, 'MANUAL');
    assert.equal(args.data.clientMutationId, 'device-1:row-42');
    assert.equal(args.data.searchText, 'Outside worksheet Algebra Wrong reason Right evidence');
    assert.ok(args.data.reviewedAt instanceof Date);
    assert.equal(args.select.version, true);
    if (persisted) {
      const error = new Error('Unique constraint failed');
      error.code = 'P2002';
      throw error;
    }
    persisted = { id: UUID_A, version: 1, ...args.data };
    return persisted;
  });
  t.mock.method(prisma.errorLog, 'findFirst', async args => {
    assert.deepEqual(args.where, { userId: 7, clientMutationId: 'device-1:row-42' });
    assert.equal(args.select.origin, true);
    assert.equal(args.select.version, true);
    return persisted;
  });

  const command = {
    userId: 7,
    data: {
      clientMutationId: 'device-1:row-42',
      source: 'Outside worksheet',
      category: 'Algebra',
      userAnswer: 'A',
      correctAnswer: 'B',
      whyWrong: '<p>Wrong reason</p>',
      whyRight: '<p>Right evidence</p>',
    },
  };
  const first = await service.createErrorLog(command);
  const retry = await service.createErrorLog(command);

  assert.equal(createCalls, 2);
  assert.equal(first.id, retry.id);
  assert.equal(retry.origin, 'MANUAL');
  assert.equal(retry.version, 1);
});

test('submission synchronization writes immutable snapshots with duplicate protection', async () => {
  const db = {
    errorLog: {
      createMany: async args => {
        assert.equal(args.skipDuplicates, true);
        assert.equal(args.data.length, 1);
        assert.equal(args.data[0].origin, 'SYSTEM_QUESTION');
        assert.equal(args.data[0].questionSnapshot.questionText, 'Which choice is most precise?');
        assert.match(args.data[0].searchText, /Practice Test 4/);
        return { count: 1 };
      },
    },
  };
  assert.equal(await service.syncSubmissionErrorLogs({ db, ...automaticFixture() }), 1);
});
