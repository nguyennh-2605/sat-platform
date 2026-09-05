const test = require('node:test');
const assert = require('node:assert/strict');
const assignmentService = require('../src/services/assignment.service');
const { _assignmentReviewHelpers } = assignmentService;

const { reviewState, summarizeStudentWork, validateMaxPoints, normalizeExternalUrl, officialSubmission, serializeSubmission } = _assignmentReviewHelpers;
const now = new Date('2026-09-04T08:00:00.000Z');

test('assignment work state distinguishes open, missing, submitted, and reviewed work', () => {
  assert.equal(reviewState(null, new Date('2026-09-05T08:00:00.000Z'), now), 'NOT_SUBMITTED');
  assert.equal(reviewState(null, new Date('2026-09-03T08:00:00.000Z'), now), 'MISSING');
  assert.equal(reviewState({ submittedAt: new Date('2026-09-04T07:00:00.000Z'), reviewedAt: null }, null, now), 'NEEDS_REVIEW');
  assert.equal(reviewState({ submittedAt: new Date('2026-09-04T07:00:00.000Z'), reviewedAt: new Date('2026-09-04T07:30:00.000Z') }, null, now), 'REVIEWED');
});

test('a resubmission after review returns to the review queue', () => {
  const submission = {
    submittedAt: new Date('2026-09-04T07:30:00.000Z'),
    reviewedAt: new Date('2026-09-04T07:00:00.000Z'),
  };
  assert.equal(reviewState(submission, null, now), 'NEEDS_REVIEW');
});

test('maximum points supports feedback-only assignments and rejects invalid ranges', () => {
  assert.equal(validateMaxPoints(undefined), undefined);
  assert.equal(validateMaxPoints(null), null);
  assert.equal(validateMaxPoints('10'), 10);
  assert.throws(() => validateMaxPoints(0), error => error.statusCode === 400);
  assert.throws(() => validateMaxPoints(10001), error => error.statusCode === 400);
});

test('student work summary keeps pending work separate from overdue missing work', () => {
  const summary = summarizeStudentWork([
    { state: 'NEEDS_REVIEW', submittedAt: now },
    { state: 'REVIEWED', submittedAt: now },
    { state: 'NOT_SUBMITTED', submittedAt: null },
    { state: 'MISSING', submittedAt: null },
  ]);
  assert.deepEqual(summary, { assigned: 4, submitted: 2, needsReview: 1, reviewed: 1, missing: 1, pending: 1 });
});

test('a private draft is not treated as an official teacher-visible submission', () => {
  const draftOnly = { submittedAt: null, contents: [{ slot: 'DRAFT', textResponse: 'Work in progress', items: [] }] };
  assert.equal(officialSubmission(draftOnly), null);
});

test('serialization keeps submitted and draft content separate', () => {
  const submission = {
    id: 'submission-1', submittedAt: now, reviewedAt: null, score: null, feedback: null,
    contents: [
      { id: 'official', slot: 'SUBMITTED', textResponse: 'Official answer', version: 2, updatedAt: now, items: [] },
      { id: 'draft', slot: 'DRAFT', textResponse: 'Half edited answer', version: 1, updatedAt: now, items: [] },
    ],
  };
  const serialized = serializeSubmission(submission);
  assert.equal(serialized.textResponse, 'Official answer');
  assert.equal(serialized.submittedContent.textResponse, 'Official answer');
  assert.equal(serialized.draftContent.textResponse, 'Half edited answer');
  assert.equal(serializeSubmission(submission, { includeDraft: false }).draftContent, null);
});

test('submission links accept only bounded http or https URLs', () => {
  assert.equal(normalizeExternalUrl(' https://docs.example.com/work '), 'https://docs.example.com/work');
  assert.throws(() => normalizeExternalUrl('javascript:alert(1)'), error => error.statusCode === 400);
  assert.throws(() => normalizeExternalUrl(`https://example.com/${'a'.repeat(2050)}`), error => error.statusCode === 400);
});

test('student work list paginates summary rows without loading submission content', async () => {
  let assignmentQuery;
  let rawQueryCalls = 0;
  const db = {
    assignment: {
      findUnique: async query => {
        assignmentQuery = query;
        return {
          id: 'assignment-1',
          classId: 'class-1',
          deadline: null,
          class: { teacherId: 4 },
          activity: null,
        };
      },
    },
    $queryRaw: async () => {
      rawQueryCalls += 1;
      if (rawQueryCalls === 1) {
        return [{ assigned: 3, submitted: 2, needsReview: 1, reviewed: 1, missing: 0, pending: 1 }];
      }
      return [
        { studentId: 10, name: 'Ada', email: 'ada@example.com', state: 'NEEDS_REVIEW', submittedAt: now, reviewedAt: null, score: null },
        { studentId: 11, name: 'Ben', email: 'ben@example.com', state: 'REVIEWED', submittedAt: now, reviewedAt: now, score: 9 },
        { studentId: 12, name: 'Cy', email: 'cy@example.com', state: 'NOT_SUBMITTED', submittedAt: null, reviewedAt: null, score: null },
      ];
    },
  };

  const result = await assignmentService.listStudentWorkWithDb({
    assignmentId: 'assignment-1', userId: 4, userRole: 'TEACHER', limit: 2,
  }, db);

  assert.equal(assignmentQuery.include, undefined);
  assert.equal(assignmentQuery.select.submissions, undefined);
  assert.equal(rawQueryCalls, 2);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].student.id, 10);
  assert.equal(result.nextCursor, '11');
  assert.deepEqual(result.summary, { assigned: 3, submitted: 2, needsReview: 1, reviewed: 1, missing: 0, pending: 1 });
});
