const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

const isClearlyTestDatabase = (value) => {
  try {
    const url = new URL(value);
    const database = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) || '');
    const schema = url.searchParams.get('schema') || '';
    return ['postgres:', 'postgresql:'].includes(url.protocol) && (/test/i.test(database) || /test/i.test(schema));
  } catch {
    return false;
  }
};

if (!testDatabaseUrl) {
  test('StudySession PostgreSQL integration tests require TEST_DATABASE_URL', { skip: true }, () => {});
} else if (!isClearlyTestDatabase(testDatabaseUrl)) {
  test('StudySession integration TEST_DATABASE_URL must visibly target a test database or schema', () => {
    assert.fail('Refusing database writes: TEST_DATABASE_URL must contain "test" in its database or schema name.');
  });
} else {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
  const prismaPath = require.resolve('../src/config/prisma');
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
  delete require.cache[require.resolve('../src/services/study-session.service')];
  const service = require('../src/services/study-session.service');

  test.before(async () => {
    await prisma.$connect();
    const [identity] = await prisma.$queryRawUnsafe('SELECT current_database() AS database_name, current_schema() AS schema_name');
    assert.ok(/test/i.test(identity.database_name) || /test/i.test(identity.schema_name));
  });

  test.after(async () => prisma.$disconnect());

  const createStudent = async (t) => {
    const token = randomUUID();
    const user = await prisma.user.create({
      data: { email: `study-session-${token}@example.test`, name: `Study Session ${token}`, role: 'STUDENT' },
    });
    t.after(async () => prisma.user.deleteMany({ where: { id: user.id, email: user.email } }));
    return user;
  };

  const startCommand = (userId, overrides = {}) => ({
    userId,
    body: {
      plannedDurationMs: 25 * 60 * 1000,
      activityType: 'PRACTICE',
      label: 'Integration focus',
      clientMutationId: `start:${randomUUID()}`,
      ...overrides,
    },
  });

  test('a focus session follows start, pause, resume, and finish transitions', async t => {
    const user = await createStudent(t);
    const started = await service.start(startCommand(user.id));
    assert.equal(started.session.status, 'RUNNING');
    assert.equal(started.session.version, 1);

    const paused = await service.pause({ userId: user.id, id: started.session.id, expectedVersion: 1 });
    assert.equal(paused.session.status, 'PAUSED');
    assert.equal(paused.session.version, 2);

    const resumed = await service.resume({ userId: user.id, id: started.session.id, expectedVersion: 2 });
    assert.equal(resumed.session.status, 'RUNNING');
    assert.equal(resumed.session.version, 3);

    const finished = await service.finish({ userId: user.id, id: started.session.id, expectedVersion: 3 });
    assert.equal(finished.session.status, 'COMPLETED');
    assert.equal(finished.session.version, 4);
    assert.ok(finished.session.endedAt);
    assert.equal((await service.getActive({ userId: user.id })).session, null);
  });

  test('start retries are idempotent and distinct concurrent starts leave one active session', async t => {
    const user = await createStudent(t);
    const clientMutationId = `retry:${randomUUID()}`;
    const [first, retry] = await Promise.all([
      service.start(startCommand(user.id, { clientMutationId })),
      service.start(startCommand(user.id, { clientMutationId })),
    ]);
    assert.equal(first.session.id, retry.session.id);

    await assert.rejects(
      service.start(startCommand(user.id)),
      error => error.statusCode === 409 && error.body.code === 'ACTIVE_STUDY_SESSION',
    );
    assert.equal(await prisma.studySession.count({ where: { userId: user.id, status: { in: ['RUNNING', 'PAUSED'] } } }), 1);
  });

  test('version and ownership checks reject stale or foreign mutations', async t => {
    const owner = await createStudent(t);
    const other = await createStudent(t);
    const started = await service.start(startCommand(owner.id));

    await assert.rejects(
      service.pause({ userId: owner.id, id: started.session.id, expectedVersion: 2 }),
      error => error.statusCode === 409 && error.body.code === 'STUDY_SESSION_VERSION_CONFLICT',
    );
    await assert.rejects(
      service.pause({ userId: other.id, id: started.session.id, expectedVersion: 1 }),
      error => error.statusCode === 404,
    );
    assert.equal((await service.getActive({ userId: other.id })).session, null);
  });

  test('reading an overdue running session completes it at the planned end time', async t => {
    const user = await createStudent(t);
    const started = await service.start(startCommand(user.id, { plannedDurationMs: 5 * 60 * 1000 }));
    const resumedAt = new Date(Date.now() - 10 * 60 * 1000);
    await prisma.studySession.update({ where: { id: started.session.id }, data: { accumulatedMs: 0, lastResumedAt: resumedAt } });

    assert.equal((await service.getActive({ userId: user.id })).session, null);
    const completed = await prisma.studySession.findUniqueOrThrow({ where: { id: started.session.id } });
    assert.equal(completed.status, 'COMPLETED');
    assert.equal(completed.accumulatedMs, completed.plannedDurationMs);
    assert.equal(completed.endedAt.getTime(), resumedAt.getTime() + completed.plannedDurationMs);
  });
}
