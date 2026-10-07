const crypto = require('crypto');
const prisma = require('../config/prisma');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const { JWT_SECRET, JWT_ACCESS_EXPIRES_IN, REFRESH_TOKEN_TTL_DAYS } = require('../config/jwt');
const { AUDIT_ACTIONS, recordAuditEvent } = require('./audit-event.service');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
const REFRESH_REUSE_GRACE_MS = 10_000;
const MAX_GOOGLE_ID_TOKEN_LENGTH = 16_384;

const normalizeEmail = value => String(value || '').trim().toLocaleLowerCase('en-US');
const isGoogleAuthoritativeForEmail = payload => normalizeEmail(payload.email).endsWith('@gmail.com') || Boolean(payload.hd);

const findUserByEmail = async (email, database = prisma) => database.user.findFirst({
  where: { email: { equals: normalizeEmail(email), mode: 'insensitive' } },
  orderBy: { id: 'asc' },
});

const resolveGoogleUser = async (payload, database = prisma, { recordRegistration = false } = {}) => {
  const normalizedEmail = normalizeEmail(payload.email);
  const subjectUser = await database.user.findUnique({ where: { googleSubject: payload.sub } });
  if (subjectUser) {
    if (!subjectUser.password) return subjectUser;
    const user = await database.user.update({ where: { id: subjectUser.id }, data: { password: null } });
    await database.refreshSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    return user;
  }

  const emailUser = await findUserByEmail(normalizedEmail, database);
  if (emailUser?.googleSubject && emailUser.googleSubject !== payload.sub) {
    throw new ApiError(409, {
      code: 'GOOGLE_ACCOUNT_CONFLICT',
      message: 'This email is already linked to another Google account.',
    });
  }

  if (emailUser) {
    if (!isGoogleAuthoritativeForEmail(payload)) {
      throw new ApiError(409, {
        code: 'GOOGLE_LEGACY_REAUTH_REQUIRED',
        message: 'This legacy account cannot be linked automatically. Contact support to verify account ownership.',
      });
    }
    const user = await database.user.update({
      where: { id: emailUser.id },
      data: { googleSubject: payload.sub, password: null },
    });
    if (emailUser.password) {
      await database.refreshSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    if (recordRegistration) await recordAuditEvent(database, { action: AUDIT_ACTIONS.USER_GOOGLE_LINKED, actorUserId: user.id, actorLabel: user.name, actorRole: user.role, entityType: 'USER', entityId: user.id, entityLabel: user.name || user.email });
    return user;
  }

  const user = await database.user.create({
    data: {
      email: normalizedEmail,
      googleSubject: payload.sub,
      name: payload.name,
      avatar: payload.picture,
      password: null,
      role: 'STUDENT',
    },
  });
  if (recordRegistration) {
    await recordAuditEvent(database, {
      action: AUDIT_ACTIONS.USER_REGISTERED,
      actorUserId: user.id,
      actorLabel: user.name,
      actorRole: user.role,
      entityType: 'USER',
      entityId: user.id,
      entityLabel: user.name || 'New student',
      metadata: { authMethod: 'GOOGLE' },
    });
  }
  return user;
};

const publicUser = user => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatar: user.avatar,
  role: user.role,
});

const signAccessToken = user => jwt.sign(
  { userId: user.id, email: user.email, role: user.role, authMethod: 'GOOGLE' },
  JWT_SECRET,
  { expiresIn: JWT_ACCESS_EXPIRES_IN },
);

const generateRefreshToken = () => crypto.randomBytes(48).toString('base64url');
const hashRefreshToken = token => crypto.createHash('sha256').update(token).digest('hex');

const createRefreshSession = async (userId, database = prisma) => {
  const refreshToken = generateRefreshToken();
  await database.refreshSession.create({
    data: {
      tokenHash: hashRefreshToken(refreshToken),
      userId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return refreshToken;
};

const createAuthResult = async (user, message, database = prisma) => {
  await database.refreshSession.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  const refreshToken = await createRefreshSession(user.id, database);
  return { message, user: publicUser(user), accessToken: signAccessToken(user), refreshToken };
};

const passwordSignInDisabled = async () => {
  throw new ApiError(410, { code: 'GOOGLE_SIGN_IN_REQUIRED', message: 'Sign in with Google to continue. Email and password sign-in is no longer available.' });
};
// Keep explicit responses for old clients; neither endpoint may create an account or session.
exports.register = passwordSignInDisabled;
exports.login = passwordSignInDisabled;

exports.googleLogin = async ({ token }, { db = prisma, googleClient = client } = {}) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new ApiError(503, { code: 'GOOGLE_AUTH_NOT_CONFIGURED', message: 'Google sign-in is temporarily unavailable.' });
  }
  if (typeof token !== 'string' || !token.trim() || token.length > MAX_GOOGLE_ID_TOKEN_LENGTH) {
    throw new ApiError(400, { code: 'GOOGLE_TOKEN_INVALID', message: 'Google sign-in credential is invalid.' });
  }

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
  } catch (error) {
    // Certificate retrieval is a server/network failure, not a bad credential.
    // Never return the library's raw error: it may contain the user's ID token.
    if (error?.message?.startsWith('Failed to retrieve verification certificates:')) {
      throw new ApiError(503, { code: 'GOOGLE_VERIFICATION_UNAVAILABLE', message: 'The server could not connect to Google to verify your sign-in. Please try again shortly.' });
    }
    throw new ApiError(401, { code: 'GOOGLE_TOKEN_INVALID', message: 'Google sign-in could not be verified. Please try again.' });
  }
  const payload = ticket.getPayload();
  if (!payload?.email) throw new ApiError(400, { message: 'Google account does not provide an email address.' });
  if (payload.email_verified !== true) throw new ApiError(403, { message: 'Google account email must be verified.' });
  if (!payload.sub) throw new ApiError(400, { code: 'GOOGLE_SUBJECT_MISSING', message: 'Google account identifier is unavailable.' });

  let user;
  try {
    user = await db.$transaction(transaction => resolveGoogleUser(payload, transaction, { recordRegistration: true }));
  } catch (error) {
    if (error?.code !== 'P2002') throw error;
    user = await db.user.findUnique({ where: { googleSubject: payload.sub } });
    if (!user) throw new ApiError(409, { code: 'GOOGLE_ACCOUNT_CONFLICT', message: 'Google account linking conflicted with another request. Please try again.' });
  }
  return createAuthResult(user, 'Google login successful', db);
};

exports.upgrade = async ({ userId }, { db = prisma } = {}) => {
  const user = await db.user.findUnique({ where: { id: Number(userId) } });
  if (!user) throw new ApiError(401, { code: 'USER_NOT_FOUND', message: 'User account is unavailable.' });
  if (!user.googleSubject) throw new ApiError(401, { code: 'GOOGLE_SIGN_IN_REQUIRED', message: 'Sign in with Google to continue.' });
  return createAuthResult(user, 'Session upgraded', db);
};

exports.refresh = async ({ refreshToken }, { db = prisma } = {}) => {
  if (!refreshToken) throw new ApiError(401, { code: 'REFRESH_TOKEN_MISSING', message: 'Refresh session is unavailable.' });

  const tokenHash = hashRefreshToken(refreshToken);
  const session = await db.refreshSession.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!session) throw new ApiError(401, { code: 'REFRESH_TOKEN_INVALID', message: 'Refresh session is invalid.' });
  if (!session.user.googleSubject) throw new ApiError(401, { code: 'GOOGLE_SIGN_IN_REQUIRED', message: 'Sign in with Google to continue.' });

  const now = new Date();
  if (session.revokedAt) {
    if (now.getTime() - session.revokedAt.getTime() <= REFRESH_REUSE_GRACE_MS) {
      throw new ApiError(409, { code: 'REFRESH_TOKEN_ROTATED', message: 'Refresh session was just rotated. Retry with the latest cookie.' });
    }
    await db.refreshSession.updateMany({
      where: { userId: session.userId, revokedAt: null },
      data: { revokedAt: now },
    });
    throw new ApiError(401, { code: 'REFRESH_TOKEN_REUSED', message: 'Refresh token reuse was detected. Please sign in again.' });
  }
  if (session.expiresAt <= now) {
    await db.refreshSession.update({ where: { id: session.id }, data: { revokedAt: now } });
    throw new ApiError(401, { code: 'REFRESH_TOKEN_EXPIRED', message: 'Refresh session has expired.' });
  }

  const rotatedRefreshToken = await db.$transaction(async transaction => {
    const revoked = await transaction.refreshSession.updateMany({
      where: { id: session.id, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now },
    });
    if (revoked.count !== 1) {
      throw new ApiError(409, { code: 'REFRESH_TOKEN_ROTATED', message: 'Refresh session was just rotated. Retry with the latest cookie.' });
    }
    return createRefreshSession(session.userId, transaction);
  });

  return {
    user: publicUser(session.user),
    accessToken: signAccessToken(session.user),
    refreshToken: rotatedRefreshToken,
  };
};

exports.logout = async ({ refreshToken }) => {
  if (!refreshToken) return;
  await prisma.refreshSession.updateMany({
    where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

exports._private = {
  hashRefreshToken,
  signAccessToken,
  normalizeEmail,
  isGoogleAuthoritativeForEmail,
  findUserByEmail,
  resolveGoogleUser,
  MAX_GOOGLE_ID_TOKEN_LENGTH,
};
