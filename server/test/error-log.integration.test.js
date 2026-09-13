const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

const inspectTestDatabaseTarget = (value) => {
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) return null;
    const database = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) || '');
    const schema = url.searchParams.get('schema') || '';
    return /test/i.test(database) || /test/i.test(schema) ? { database, schema } : null;
  } catch {
    return null;
  }
};

if (!testDatabaseUrl) {
  test('Error Log PostgreSQL integration tests require TEST_DATABASE_URL', { skip: true }, () => {});
} else {
  const safeTarget = inspectTestDatabaseTarget(testDatabaseUrl);

  if (!safeTarget) {
    test('TEST_DATABASE_URL must visibly target a test database or schema', () => {
      assert.fail('Refusing database writes: the database name or schema in TEST_DATABASE_URL must contain "test".');
    });
  } else {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    const prismaPath = require.resolve('../src/config/prisma');
    require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
    delete require.cache[require.resolve('../src/services/error-log.service')];
    const service = require('../src/services/error-log.service');

    test.before(async () => {
      await prisma.$connect();
      const [identity] = await prisma.$queryRawUnsafe(
        'SELECT current_database() AS database_name, current_schema() AS schema_name',
      );
      assert.ok(
        /test/i.test(identity.database_name) || /test/i.test(identity.schema_name),
        'Connected database identity must still visibly contain "test" before fixtures are written.',
      );
    });

    test.after(async () => {
      await prisma.$disconnect();
    });

    const createStudent = async (t) => {
      const token = randomUUID();
      const user = await prisma.user.create({
        data: {
          email: `error-log-integration-${token}@example.test`,
          name: `Error Log Integration ${token}`,
          role: 'STUDENT',
        },
      });
      t.after(async () => {
        await prisma.user.deleteMany({ where: { id: user.id, email: user.email } });
      });
      return user;
    };

    test('concurrent disjoint reflection saves merge without violating derived review status', async t => {
      const user = await createStudent(t);
      const created = await service.createErrorLog({
        userId: user.id,
        data: {
          clientMutationId: `concurrent:${randomUUID()}`,
          source: 'Concurrency worksheet',
          category: 'Algebra',
          userAnswer: 'A',
          correctAnswer: 'B',
        },
      });

      const results = await Promise.all([
        service.updateErrorLog({
          id: created.id,
          userId: user.id,
          data: { whyWrong: '<p>I distributed the sign incorrectly.</p>' },
        }),
        service.updateErrorLog({
          id: created.id,
          userId: user.id,
          data: { whyRight: '<p>The correct choice preserves both signs.</p>' },
        }),
      ]);

      const persisted = await prisma.errorLog.findUniqueOrThrow({ where: { id: created.id } });
      assert.equal(persisted.whyWrong, '<p>I distributed the sign incorrectly.</p>');
      assert.equal(persisted.whyRight, '<p>The correct choice preserves both signs.</p>');
      assert.ok(persisted.reviewedAt instanceof Date);
      assert.equal(persisted.version, 3);
      assert.deepEqual(results.map(result => result.version).sort((a, b) => a - b), [2, 3]);

      await service.updateErrorLog({
        id: created.id,
        userId: user.id,
        data: { expectedVersion: persisted.version, whyWrong: '<p><br></p>' },
      });
      const reopened = await prisma.errorLog.findUniqueOrThrow({ where: { id: created.id } });
      assert.equal(reopened.whyWrong, null);
      assert.equal(reopened.reviewedAt, null);
      assert.equal(reopened.version, 4);
    });

    test('manual retries with the same client mutation id create exactly one row', async t => {
      const user = await createStudent(t);
      const clientMutationId = `manual:${randomUUID()}`;
      const command = {
        userId: user.id,
        data: {
          clientMutationId,
          source: 'External practice set',
          sourceUrl: 'https://example.com/practice',
          category: 'Craft and Structure',
          userAnswer: 'C',
          correctAnswer: 'A',
        },
      };

      const [first, retry] = await Promise.all([
        service.createErrorLog(command),
        service.createErrorLog(command),
      ]);

      assert.equal(first.id, retry.id);
      assert.equal(first.origin, 'MANUAL');
      assert.equal(first.version, 1);
      assert.equal(await prisma.errorLog.count({ where: { userId: user.id, clientMutationId } }), 1);
    });

    test('a system question snapshot remains readable after its source Question is deleted', async t => {
      const user = await createStudent(t);
      const sourceTest = await prisma.test.create({
        data: {
          title: `Snapshot source ${randomUUID()}`,
          subject: 'RW',
          sections: {
            create: {
              name: 'Module 1',
              order: 1,
              duration: 32,
              questions: {
                create: {
                  type: 'MCQ',
                  blocks: [{ type: 'text', content: 'Original passage.' }],
                  questionText: 'What does the passage imply?',
                  choices: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
                  correctAnswer: 'B',
                  explanation: 'Choice B follows from the final sentence.',
                  order: 1,
                },
              },
            },
          },
        },
        include: { sections: { include: { questions: true } } },
      });
      t.after(async () => {
        await prisma.test.deleteMany({ where: { id: sourceTest.id } });
      });

      const section = sourceTest.sections[0];
      const question = section.questions[0];
      const snapshot = {
        type: question.type,
        blocks: question.blocks,
        questionText: question.questionText,
        choices: question.choices,
        explanation: question.explanation,
        order: question.order,
        section: {
          name: section.name,
          order: section.order,
          test: { title: sourceTest.title, subject: sourceTest.subject },
        },
      };
      const entry = await prisma.errorLog.create({
        data: {
          userId: user.id,
          questionId: question.id,
          origin: 'SYSTEM_QUESTION',
          source: `${sourceTest.title} · Module 1 · Question 1`,
          category: 'General',
          userAnswer: 'A',
          correctAnswer: 'B',
          questionSnapshot: snapshot,
          searchText: `${sourceTest.title} General`,
        },
      });

      await prisma.question.delete({ where: { id: question.id } });
      const detached = await prisma.errorLog.findUniqueOrThrow({ where: { id: entry.id } });
      assert.equal(detached.questionId, null);
      assert.equal(detached.origin, 'SYSTEM_QUESTION');

      assert.deepEqual(
        await service.getErrorLogQuestion({ id: entry.id, userId: user.id }),
        { question: { ...snapshot, choices: [
          { id: 'A', text: 'Choice A' },
          { id: 'B', text: 'Choice B' },
          { id: 'C', text: 'Choice C' },
          { id: 'D', text: 'Choice D' },
        ] } },
      );
    });
  }
}
