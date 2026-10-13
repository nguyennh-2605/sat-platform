const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizedDueAt,
  normalizedTitle,
  priorityFor,
  sortTasks,
  taskSummary,
  normalizedPlannedDate,
  scheduleTaskWithDb,
  getTasksWithDb,
  normalizedStudyPlan,
  createTaskWithDb,
  updateTaskWithDb,
  deleteTaskWithDb,
  normalizedCalendarColor,
} = require('../src/services/student-task.service');

test('student task validation normalizes titles and rejects invalid dates', () => {
  assert.equal(normalizedTitle('  Review   algebra  '), 'Review algebra');
  assert.equal(normalizedTitle('  review SAT algebra  '), 'Review SAT algebra');
  assert.equal(normalizedTitle('ôn tập SAT'), 'Ôn tập SAT');
  assert.throws(() => normalizedTitle(`ß${'a'.repeat(159)}`), /160 characters/);
  assert.throws(() => normalizedTitle('  '), /Task title is required/);
  assert.equal(normalizedDueAt(null), null);
  assert.throws(() => normalizedDueAt('not-a-date'), /valid task date/);
});

test('study days reject invalid dates and preserve a date-only value', () => {
  assert.equal(normalizedPlannedDate('2028-02-29'), '2028-02-29');
  assert.equal(normalizedPlannedDate(null), null);
  for (const value of [undefined, '', '2026-02-29', '2026-10-07T00:00:00Z', '2026-13-01', '1999-01-01']) assert.throws(() => normalizedPlannedDate(value), /valid study day/);
});

const plannerDb = () => {
  const records = [];
  const personal = [{ id: 'mine', userId: 7, title: 'Review algebra', details: null, completedAt: null, dueAt: null, createdAt: new Date(), position: 1 }];
  const db = {
    studentTask: {
      findMany: async ({ where }) => personal.filter(task => task.userId === where.userId),
      findFirst: async ({ where }) => personal.find(task => task.userId === where.userId && (!where.id || task.id === where.id)) || null,
      create: async ({ data }) => { const task = { id: `new-${personal.length}`, createdAt: new Date(), completedAt: null, ...data }; personal.push(task); return task; },
      update: async ({ where, data }) => { const task = personal.find(task => task.id === where.id); Object.assign(task, data); return task; },
      deleteMany: async ({ where }) => { const index = personal.findIndex(task => task.id === where.id && task.userId === where.userId); if (index < 0) return { count: 0 }; personal.splice(index, 1); return { count: 1 }; },
    },
    userTodoState: {
      findMany: async ({ where }) => records.filter(state => state.userId === where.userId),
      findUnique: async ({ where }) => records.find(state => state.userId === where.userId_itemKey.userId && state.itemKey === where.userId_itemKey.itemKey) || null,
      upsert: async ({ where, update, create }) => { const old = records.find(state => state.userId === where.userId_itemKey.userId && state.itemKey === where.userId_itemKey.itemKey); if (old) Object.assign(old, update); else records.push(create); },
      deleteMany: async ({ where }) => { const index = records.findIndex(state => state.userId === where.userId && state.itemKey === where.itemKey); if (index >= 0) records.splice(index, 1); },
    },
    classAnnouncement: { findMany: async () => [] }, assignment: { findMany: async () => [] }, classActivity: { findMany: async () => [] },
    testDelivery: { findMany: async ({ where }) => where.assignees.some.studentId === 7 ? [{ id: 'assigned', classId: 'class', createdAt: new Date(), dueAt: new Date('2026-10-16T10:00:00Z'), class: { name: 'SAT Class' }, test: { id: 9, title: 'Module check', mode: 'EXAM', duration: 30, sections: [{ _count: { questions: 12 } }] }, submissions: [] }] : [] },
  };
  db.$transaction = async callback => {
    const priorTasks = structuredClone(personal), priorStates = structuredClone(records);
    try { return await callback(db); }
    catch (error) { personal.splice(0, personal.length, ...priorTasks); records.splice(0, records.length, ...priorStates); throw error; }
  };
  return { db, records, personal };
};

test('planning coursework changes only the learner schedule, not deadline or completion', async () => {
  const { db, records } = plannerDb();
  await scheduleTaskWithDb({ db, userId: 7, userRole: 'STUDENT', itemKey: 'student-test:assigned', plannedDate: '2026-10-14' });
  const result = await getTasksWithDb({ db, userId: 7, userRole: 'STUDENT' });
  const task = result.items.find(item => item.key === 'student-test:assigned');
  assert.equal(task.plannedDate, '2026-10-14');
  assert.equal(task.dueAt.toISOString(), '2026-10-16T10:00:00.000Z');
  assert.equal(task.completed, false);
  assert.equal(task.canComplete, false);
  assert.deepEqual(Object.keys(records[0]).sort(), ['itemKey', 'plannedDate', 'plannedEndMinutes', 'plannedStartMinutes', 'userId']);
  await scheduleTaskWithDb({ db, userId: 7, userRole: 'STUDENT', itemKey: task.key, plannedDate: null });
  assert.equal(records[0].plannedDate, null);
});

test('study planning rejects another learner’s tasks and non-student roles', async () => {
  const { db, records } = plannerDb();
  await assert.rejects(scheduleTaskWithDb({ db, userId: 8, userRole: 'STUDENT', itemKey: 'personal:mine', plannedDate: '2026-10-14' }), /Task not found/);
  await assert.rejects(scheduleTaskWithDb({ db, userId: 7, userRole: 'TEACHER', itemKey: 'personal:mine', plannedDate: '2026-10-14' }), /students only/);
  assert.equal(records.length, 0);
});

test('today and week summaries include planned days without treating future unscheduled deadlines as today', () => {
  const summary = taskSummary([
    { completed: false, plannedDate: '2026-10-07', dueAt: '2026-10-16T10:00:00Z' },
    { completed: false, plannedDate: '2026-10-09', source: 'PERSONAL', dueAt: null },
    { completed: true, plannedDate: '2026-10-08', dueAt: null },
  ], new Date('2026-10-07T08:00:00Z'));
  assert.equal(summary.todayRemaining, 1);
  assert.equal(summary.weekTotal, 3);
  assert.equal(summary.weekCompleted, 1);
});

test('student task ordering respects persisted order before urgency', () => {
  const tasks = [
    { key: 'second', completed: false, position: 2, priority: 'OVERDUE', createdAt: '2026-08-20T00:00:00Z', dueAt: '2026-08-21T00:00:00Z' },
    { key: 'first', completed: false, position: 1, priority: 'NORMAL', createdAt: '2026-08-20T00:00:00Z', dueAt: null },
    { key: 'done', completed: true, position: 0, priority: 'NORMAL', createdAt: '2026-08-20T00:00:00Z', dueAt: null },
  ];
  assert.deepEqual(sortTasks(tasks).map(item => item.key), ['first', 'second', 'done']);
});

test('student task priority distinguishes overdue and due-soon work', () => {
  assert.equal(priorityFor(new Date(Date.now() - 1_000)), 'OVERDUE');
  assert.equal(priorityFor(new Date(Date.now() + 60 * 60 * 1_000)), 'DUE_SOON');
  assert.equal(priorityFor(null), 'NORMAL');
});

test('weekly summary uses completion of learner-planned events only', () => {
  const now = new Date('2026-08-27T08:00:00Z');
  const summary = taskSummary([
    { source: 'PERSONAL', type: 'PERSONAL', completed: false, plannedDate: '2026-08-27', dueAt: null, createdAt: now },
    { source: 'CLASSROOM', type: 'TEST', completed: true, plannedDate: '2026-08-28', dueAt: '2026-08-28T08:00:00Z', createdAt: now },
    { source: 'CLASSROOM', type: 'ASSIGNMENT', completed: false, dueAt: '2026-08-29T08:00:00Z', createdAt: now },
    { source: 'PERSONAL', type: 'PERSONAL', completed: false, plannedDate: '2026-08-26', dueAt: '2026-08-27T08:00:00Z', createdAt: now },
  ], now);
  assert.equal(summary.todayRemaining, 1);
  assert.equal(summary.weekCompleted, 1);
  assert.equal(summary.weekTotal, 2);
  assert.equal(summary.weekPercentage, 50);
});


test('timed plans validate paired integer times, minimum duration and end of day', () => {
  const day = { plannedDate: '2026-10-14' };
  assert.deepEqual(normalizedStudyPlan(day), { ...day, plannedStartMinutes: null, plannedEndMinutes: null });
  assert.equal(normalizedStudyPlan({ ...day, plannedStartMinutes: 1425, plannedEndMinutes: 1440 }).plannedEndMinutes, 1440);
  for (const [start, end] of [[540, 530], [-1, 60], [1425, 1441], [540, 550], [540.5, 600], ['540', 600], [540, null], [null, 600]]) {
    assert.throws(() => normalizedStudyPlan({ ...day, plannedStartMinutes: start, plannedEndMinutes: end }), /valid start and end time/);
  }
  assert.throws(() => normalizedStudyPlan({ plannedDate: null, plannedStartMinutes: 540, plannedEndMinutes: 600 }), /needs a study day/);
});

test('coursework is available to link but produces no calendar markers until the student plans it', async () => {
  const { db } = plannerDb();
  const params = { db, userId: 7, userRole: 'STUDENT' };
  const initial = await getTasksWithDb(params);
  assert.equal(initial.items.length, 2);
  assert.deepEqual(initial.calendar, []);
  assert.deepEqual(initial.summary, { todayRemaining: 0, weekCompleted: 0, weekTotal: 0, weekPercentage: 0 });
  await scheduleTaskWithDb({ ...params, itemKey: 'student-test:assigned', plannedDate: '2026-10-14', plannedStartMinutes: 540, plannedEndMinutes: 600 });
  const planned = await getTasksWithDb(params);
  assert.deepEqual(planned.calendar, [{ date: '2026-10-14', total: 1, incomplete: 1, hasDeadline: false }]);
  assert.equal(planned.items.find(item => item.key === 'student-test:assigned').dueAt.toISOString(), '2026-10-16T10:00:00.000Z');
  await scheduleTaskWithDb({ ...params, itemKey: 'student-test:assigned', plannedDate: null });
  assert.deepEqual((await getTasksWithDb(params)).calendar, []);
});

test('timed coursework persists through reads and date-only moves preserve its times', async () => {
  const { db, records } = plannerDb();
  const params = { db, userId: 7, userRole: 'STUDENT', itemKey: 'student-test:assigned' };
  await scheduleTaskWithDb({ ...params, plannedDate: '2026-10-14', plannedStartMinutes: 540, plannedEndMinutes: 600 });
  await scheduleTaskWithDb({ ...params, plannedDate: '2026-10-15' });
  const task = (await getTasksWithDb({ db, userId: 7, userRole: 'STUDENT' })).items.find(task => task.key === params.itemKey);
  assert.equal(task.plannedStartMinutes, 540);
  assert.equal(task.plannedEndMinutes, 600);
  assert.equal(task.dueAt.toISOString(), '2026-10-16T10:00:00.000Z');
  assert.equal(task.canComplete, false);
  await scheduleTaskWithDb({ ...params, plannedDate: null });
  assert.equal(records[0].plannedStartMinutes, null);
  assert.equal(records[0].plannedEndMinutes, null);
});

test('event creation persists title, notes and schedule in one transaction', async () => {
  const { db, records } = plannerDb();
  const event = await createTaskWithDb({ db, userId: 7, userRole: 'STUDENT', data: { title: 'Practice algebra', details: 'Review equations', plannedDate: '2026-10-14', plannedStartMinutes: 570, plannedEndMinutes: 630 } });
  const saved = (await getTasksWithDb({ db, userId: 7, userRole: 'STUDENT' })).items.find(task => task.id === event.id);
  assert.equal(saved.title, 'Practice algebra');
  assert.equal(saved.description, 'Review equations');
  assert.equal(saved.plannedStartMinutes, 570);
  assert.equal(saved.plannedEndMinutes, 630);
  assert.equal(saved.dueAt, null);
  assert.equal(records[0].userId, 7);
});

test('invalid times and failed schedule writes leave no half-created event', async () => {
  const { db, records, personal } = plannerDb();
  const params = { db, userId: 7, userRole: 'STUDENT' };
  await assert.rejects(createTaskWithDb({ ...params, data: { title: 'Invalid', plannedDate: '2026-10-14', plannedStartMinutes: 600, plannedEndMinutes: 540 } }), /valid start and end time/);
  assert.equal(personal.length, 1);
  db.userTodoState.upsert = async () => { throw new Error('Schedule unavailable'); };
  await assert.rejects(createTaskWithDb({ ...params, data: { title: 'Rollback', plannedDate: '2026-10-14', plannedStartMinutes: 540, plannedEndMinutes: 600 } }), /Schedule unavailable/);
  assert.equal(personal.length, 1);
  assert.equal(records.length, 0);
});

test('event editing protects ownership and rolls back title and times together', async () => {
  const { db, personal } = plannerDb();
  const data = { title: 'Changed title', plannedDate: '2026-10-14', plannedStartMinutes: 660, plannedEndMinutes: 720 };
  await assert.rejects(updateTaskWithDb({ db, taskId: 'mine', userId: 8, userRole: 'STUDENT', data }), /Task not found/);
  await updateTaskWithDb({ db, taskId: 'mine', userId: 7, userRole: 'STUDENT', data });
  const saved = (await getTasksWithDb({ db, userId: 7, userRole: 'STUDENT' })).items.find(task => task.id === 'mine');
  assert.equal(saved.title, 'Changed title');
  assert.equal(saved.plannedStartMinutes, 660);
  db.userTodoState.upsert = async () => { throw new Error('Schedule unavailable'); };
  await assert.rejects(updateTaskWithDb({ db, taskId: 'mine', userId: 7, userRole: 'STUDENT', data: { ...data, title: 'Must roll back' } }), /Schedule unavailable/);
  assert.equal(personal[0].title, 'Changed title');
});

test('deleting an owned event also removes its plan and cannot delete another learner record', async () => {
  const { db, records, personal } = plannerDb();
  await scheduleTaskWithDb({ db, userId: 7, userRole: 'STUDENT', itemKey: 'personal:mine', plannedDate: '2026-10-14', plannedStartMinutes: 540, plannedEndMinutes: 600 });
  await assert.rejects(deleteTaskWithDb({ db, taskId: 'mine', userId: 8, userRole: 'STUDENT' }), /Task not found/);
  assert.equal(personal.length, 1);
  await deleteTaskWithDb({ db, taskId: 'mine', userId: 7, userRole: 'STUDENT' });
  assert.equal(personal.length, 0);
  assert.equal(records.length, 0);
});

test('event colors accept a controlled palette and reject arbitrary color values', () => {
  for (const color of ['BLUE', 'VIOLET', 'TEAL', 'AMBER', null]) assert.equal(normalizedCalendarColor(color), color);
  for (const color of ['RED', '#ff0000', '', 'blue', 1, {}]) assert.throws(() => normalizedCalendarColor(color), /valid event color/);
});

test('personal event colors survive reads, color-only edits and date moves', async () => {
  const { db } = plannerDb();
  const params = { db, userId: 7, userRole: 'STUDENT' };
  const created = await createTaskWithDb({ ...params, data: { title: 'Colored event', calendarColor: 'VIOLET', plannedDate: '2026-10-14', plannedStartMinutes: 540, plannedEndMinutes: 600 } });
  let saved = (await getTasksWithDb(params)).items.find(task => task.id === created.id);
  assert.equal(saved.calendarColor, 'VIOLET');
  await updateTaskWithDb({ ...params, taskId: created.id, data: { calendarColor: 'TEAL' } });
  await scheduleTaskWithDb({ ...params, itemKey: saved.key, plannedDate: '2026-10-15' });
  saved = (await getTasksWithDb(params)).items.find(task => task.id === created.id);
  assert.equal(saved.calendarColor, 'TEAL');
  assert.equal(saved.plannedStartMinutes, 540);
  assert.equal(saved.plannedEndMinutes, 600);
  await updateTaskWithDb({ ...params, taskId: created.id, data: { calendarColor: null } });
  assert.equal((await getTasksWithDb(params)).items.find(task => task.id === created.id).calendarColor, null);
});

test('coursework color belongs to the learner and does not alter the source category or deadline', async () => {
  const { db } = plannerDb();
  const params = { db, userId: 7, userRole: 'STUDENT' };
  await scheduleTaskWithDb({ ...params, itemKey: 'student-test:assigned', plannedDate: '2026-10-14', calendarColor: 'AMBER' });
  const task = (await getTasksWithDb(params)).items.find(task => task.key === 'student-test:assigned');
  assert.equal(task.calendarColor, 'AMBER');
  assert.equal(task.type, 'TEST');
  assert.equal(task.dueAt.toISOString(), '2026-10-16T10:00:00.000Z');
  assert.equal(task.canComplete, false);
  assert.equal((await getTasksWithDb({ ...params, userId: 8 })).items.length, 0);
});
