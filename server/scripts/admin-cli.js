require('dotenv').config();

const os = require('os');
const readline = require('readline/promises');

const prisma = require('../src/config/prisma');

const COMMANDS = new Set(['create', 'promote', 'rotate-password', 'revoke-sessions', 'demote']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'host.docker.internal']);

const parseArgs = argv => {
  const [command, ...tokens] = argv;
  const flags = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const name = token.slice(2);
    if (name === 'password') throw new Error('Passwords are never accepted as command-line arguments.');
    const next = tokens[index + 1];
    if (!next || next.startsWith('--')) flags[name] = true;
    else { flags[name] = next; index += 1; }
  }
  return { command, flags };
};

const normalizeEmail = value => String(value || '').trim().toLocaleLowerCase('en-US');
const validateEmail = email => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Provide a valid email with --email.');
};


const databaseHost = databaseUrl => {
  try { return new URL(databaseUrl).hostname; }
  catch { throw new Error('DATABASE_URL is missing or invalid.'); }
};

const resolveEnvironment = ({ requested, databaseUrl }) => {
  if (!['local', 'production'].includes(requested)) throw new Error('Use --environment local or --environment production.');
  const host = databaseHost(databaseUrl);
  const remoteDatabase = !LOCAL_HOSTS.has(host);
  if (requested === 'local' && remoteDatabase) throw new Error(`Refusing local mode because DATABASE_URL points to remote host ${host}.`);
  if (requested === 'production' && !remoteDatabase) throw new Error('Refusing production mode because DATABASE_URL points to a local database.');
  return requested;
};

const askLine = async prompt => {
  const interface_ = readline.createInterface({ input: process.stdin, output: process.stdout });
  try { return (await interface_.question(prompt)).trim(); }
  finally { interface_.close(); }
};

const actorName = () => `${process.env.USERNAME || process.env.USER || 'unknown'}@${os.hostname()}`;
const auditData = ({ action, user, environment, metadata }) => ({
  action,
  targetUserId: user.id,
  targetEmail: user.email,
  environment,
  actor: actorName(),
  metadata,
});

const confirmProduction = async flags => {
  if (flags['confirm-production'] !== true) throw new Error('Production changes require --confirm-production.');
  const answer = await askLine('Type PRODUCTION to continue: ');
  if (answer !== 'PRODUCTION') throw new Error('Production confirmation did not match.');
};

const validateProductionGoogleAccount = user => {
  if (user.password !== null || !user.googleSubject) {
    throw new Error('Admin promotion requires an account verified through Google sign-in without an application password.');
  }
};

const promoteAdmin = async ({ email, environment }) => prisma.$transaction(async transaction => {
  const existing = await transaction.user.findUnique({ where: { email } });
  if (!existing) throw new Error('Account not found. Sign in once before promoting this email.');
  validateProductionGoogleAccount(existing);
  if (existing.role === 'ADMIN') return { user: existing, unchanged: true, revoked: 0 };
  const revoked = await transaction.refreshSession.deleteMany({ where: { userId: existing.id } });
  const user = await transaction.user.update({ where: { id: existing.id }, data: { role: 'ADMIN' } });
  await transaction.adminAuditLog.create({ data: auditData({ action: 'ADMIN_PROMOTED', user, environment, metadata: { previousRole: existing.role, revokedSessions: revoked.count } }) });
  return { user, unchanged: false, revoked: revoked.count };
});

const revokeSessions = async ({ email, environment }) => prisma.$transaction(async transaction => {
  const user = await transaction.user.findUnique({ where: { email } });
  if (!user || user.role !== 'ADMIN') throw new Error('Admin account not found.');
  const revoked = await transaction.refreshSession.deleteMany({ where: { userId: user.id } });
  await transaction.adminAuditLog.create({ data: auditData({ action: 'ADMIN_SESSIONS_REVOKED', user, environment, metadata: { revokedSessions: revoked.count } }) });
  return { user, revoked: revoked.count };
});

const demoteAdmin = async ({ email, environment, role }) => prisma.$transaction(async transaction => {
  if (!['STUDENT', 'TEACHER'].includes(role)) throw new Error('Demotion role must be STUDENT or TEACHER.');
  const existing = await transaction.user.findUnique({ where: { email } });
  if (!existing || existing.role !== 'ADMIN') throw new Error('Admin account not found.');
  if (await transaction.user.count({ where: { role: 'ADMIN' } }) <= 1) throw new Error('Refusing to demote the final Admin account.');
  const revoked = await transaction.refreshSession.deleteMany({ where: { userId: existing.id } });
  const user = await transaction.user.update({ where: { id: existing.id }, data: { role } });
  await transaction.adminAuditLog.create({ data: auditData({ action: 'ADMIN_DEMOTED', user, environment, metadata: { previousRole: 'ADMIN', newRole: role, revokedSessions: revoked.count } }) });
  return { user, revoked: revoked.count };
});

const main = async () => {
  const { command, flags } = parseArgs(process.argv.slice(2));
  if (!COMMANDS.has(command)) throw new Error(`Choose a command: ${[...COMMANDS].join(', ')}.`);
  if (command === 'create' || command === 'rotate-password') throw new Error('Password administration is disabled. Sign in with Google, then use admin:promote for the verified account.');
  const email = normalizeEmail(flags.email);
  validateEmail(email);
  const environment = resolveEnvironment({ requested: flags.environment, databaseUrl: process.env.DATABASE_URL });
  if (environment === 'production') await confirmProduction(flags);

  let result;

  if (command === 'promote') result = await promoteAdmin({ email, environment });

  if (command === 'revoke-sessions') result = await revokeSessions({ email, environment });
  if (command === 'demote') result = await demoteAdmin({ email, environment, role: String(flags.role || 'STUDENT').toUpperCase() });

  const user = result.user || result;
  console.log(`${command} completed for ${user.email} (${user.role}).`);
  if (result.unchanged) console.log('No database change was needed.');
  if (Number.isInteger(result.revoked)) console.log(`Revoked refresh sessions: ${result.revoked}.`);
};

if (require.main === module) {
  main().catch(error => { console.error(`Admin CLI error: ${error.message}`); process.exitCode = 1; }).finally(() => prisma.$disconnect());
}

module.exports = { parseArgs, normalizeEmail, resolveEnvironment, validateProductionGoogleAccount };
