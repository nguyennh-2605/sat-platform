const test = require('node:test');
const assert = require('node:assert/strict');
const { _helpers } = require('../src/services/lesson-workspace.service');
const { lessonBlockPhase } = require('../src/services/lesson-block.service');

const textBlock = (progress = [], required = true) => ({
  id: 'text-1', kind: 'TEXT', isRequired: required, progress, resource: null, activity: null,
});

const resourceBlock = (progress = [], required = true) => ({
  id: 'resource-1', kind: 'RESOURCE', isRequired: required, progress: [],
  resource: { progress }, activity: null,
});

const activityBlock = (assignees = [], required = true) => ({
  id: 'activity-1', kind: 'ACTIVITY', isRequired: required, progress: [], resource: null,
  activity: { assignees },
});

test('lesson completion counts required text, resource, and assigned activity blocks', () => {
  const now = new Date('2026-09-17T00:00:00.000Z');
  const blocks = [
    textBlock([{ studentId: 7, completedAt: now, lastOpenedAt: now }]),
    resourceBlock([{ studentId: 7, completedAt: now, lastOpenedAt: now }]),
    activityBlock([{ studentId: 7, status: 'COMPLETED', completedAt: now, excusedAt: null }]),
  ];
  const progress = _helpers.progressForStudent(blocks, 7);
  assert.equal(progress.status, 'COMPLETED');
  assert.equal(progress.percent, 100);
  assert.equal(progress.completedBlocks, 3);
});

test('activities assigned to other students do not block lesson completion', () => {
  const now = new Date('2026-09-17T00:00:00.000Z');
  const blocks = [
    textBlock([{ studentId: 7, completedAt: now, lastOpenedAt: now }]),
    activityBlock([{ studentId: 8, status: 'ASSIGNED', completedAt: null, excusedAt: null }]),
  ];
  const progress = _helpers.progressForStudent(blocks, 7);
  assert.equal(progress.requiredBlocks, 1);
  assert.equal(progress.status, 'COMPLETED');
});

test('optional content does not prevent automatic lesson completion', () => {
  const now = new Date('2026-09-17T00:00:00.000Z');
  const blocks = [
    textBlock([{ studentId: 7, completedAt: now, lastOpenedAt: now }]),
    resourceBlock([], false),
  ];
  const progress = _helpers.progressForStudent(blocks, 7);
  assert.equal(progress.requiredBlocks, 1);
  assert.equal(progress.completedBlocks, 1);
  assert.equal(progress.status, 'COMPLETED');
});

test('the next required incomplete block is used for resume', () => {
  const now = new Date('2026-09-17T00:00:00.000Z');
  const first = textBlock([{ studentId: 7, completedAt: now, lastOpenedAt: now }]);
  const second = { ...resourceBlock(), id: 'resource-next' };
  const progress = _helpers.progressForStudent([first, second], 7);
  assert.equal(progress.status, 'IN_PROGRESS');
  assert.equal(progress.nextBlockId, 'resource-next');
  assert.equal(progress.percent, 50);
});

test('lesson content defaults to the during-class stage', () => {
  assert.equal(lessonBlockPhase(), 'DURING_CLASS');
  assert.equal(lessonBlockPhase('before_class'), 'BEFORE_CLASS');
});

test('lesson content rejects an unknown stage', () => {
  assert.throws(() => lessonBlockPhase('OFFICE_HOURS'), error => error.statusCode === 400);
});
