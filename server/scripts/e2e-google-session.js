// CLI-only fixture setup. There is deliberately no HTTP endpoint for synthetic identities.
const databaseUrl = process.env.DATABASE_URL || '';
const databaseName = (() => { try { return decodeURIComponent(new URL(databaseUrl).pathname.slice(1)); } catch { return ''; } })();
if (process.env.NODE_ENV !== 'test' || !/test/i.test(databaseName)) {
  throw new Error('Google session fixtures require NODE_ENV=test and a database name containing test.');
}
const prisma = require('../src/config/prisma');
const auth = require('../src/services/auth.service');
const teacherAccess = require('../src/services/teacher-access.service');

const main = async () => {
  const [email, name, role] = process.argv.slice(2);
  if (!email?.endsWith('@example.test') || !['STUDENT', 'TEACHER'].includes(role)) throw new Error('Invalid test identity.');
  const user = await prisma.user.create({ data: { email, name, googleSubject: `e2e-${crypto.randomUUID()}`, password: null, role: 'STUDENT' } });
  if (role === 'TEACHER') {
    const reviewer = await prisma.user.create({ data: { email: `e2e.admin.${crypto.randomUUID()}@example.test`, name: 'E2E Admin', googleSubject: `e2e-${crypto.randomUUID()}`, role: 'ADMIN' } });
    const { request } = await teacherAccess.submit({ userId: user.id, reason: 'Teacher fixture in an isolated test database.' });
    await teacherAccess.review({ userId: reviewer.id, requestId: request.id, decision: 'APPROVED' });
  }
  const { accessToken, refreshToken, user: identity } = await auth.upgrade({ userId: user.id });
  process.stdout.write(JSON.stringify({ user: identity, accessToken, refreshToken }));
};
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
