const crypto = require('crypto');
const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const { JWT_SECRET, JWT_ACCESS_EXPIRES_IN, REFRESH_TOKEN_TTL_DAYS } = require('../config/jwt');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const ALLOWED_REGISTER_ROLES = ['STUDENT', 'TEACHER'];
const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
const REFRESH_REUSE_GRACE_MS = 10_000;

const publicUser = user => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatar: user.avatar,
  role: user.role,
});

const signAccessToken = user => jwt.sign(
  { userId: user.id, email: user.email, role: user.role },
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

const createAuthResult = async (user, message) => {
  await prisma.refreshSession.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  const refreshToken = await createRefreshSession(user.id);
  return { message, user: publicUser(user), accessToken: signAccessToken(user), refreshToken };
};

exports.register = async ({ email, password, name, role }) => {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new ApiError(400, { message: 'Email này đã được sử dụng!' });

  const requestedRole = role || 'STUDENT';
  if (!ALLOWED_REGISTER_ROLES.includes(requestedRole)) {
    throw new ApiError(400, { message: 'Vai trò không hợp lệ. Chỉ được chọn Học sinh hoặc Giáo viên.' });
  }

  const user = await prisma.user.create({
    data: { email, password: await bcrypt.hash(password, 10), name, role: requestedRole },
  });
  return createAuthResult(user, 'Đăng ký thành công!');
};

exports.login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new ApiError(400, { message: 'Email chưa được đăng ký!' });
  if (!user.password) {
    throw new ApiError(400, { message: "Tài khoản này đăng ký bằng Google. Vui lòng chọn 'Login with Google'." });
  }
  if (!await bcrypt.compare(password, user.password)) {
    throw new ApiError(400, { message: 'Sai mật khẩu!' });
  }
  return createAuthResult(user, 'Đăng nhập thành công!');
};

exports.googleLogin = async ({ token }) => {
  const ticket = await client.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.email) throw new ApiError(400, { message: 'Google account does not provide an email address.' });
  if (payload.email_verified !== true) throw new ApiError(403, { message: 'Google account email must be verified.' });

  let user = await prisma.user.findUnique({ where: { email: payload.email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email: payload.email, name: payload.name, avatar: payload.picture, password: null },
    });
  }
  return createAuthResult(user, 'Google login successful');
};

exports.upgrade = async ({ userId }) => {
  const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
  if (!user) throw new ApiError(401, { code: 'USER_NOT_FOUND', message: 'User account is unavailable.' });
  return createAuthResult(user, 'Session upgraded');
};

exports.refresh = async ({ refreshToken }) => {
  if (!refreshToken) throw new ApiError(401, { code: 'REFRESH_TOKEN_MISSING', message: 'Refresh session is unavailable.' });

  const tokenHash = hashRefreshToken(refreshToken);
  const session = await prisma.refreshSession.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!session) throw new ApiError(401, { code: 'REFRESH_TOKEN_INVALID', message: 'Refresh session is invalid.' });

  const now = new Date();
  if (session.revokedAt) {
    if (now.getTime() - session.revokedAt.getTime() <= REFRESH_REUSE_GRACE_MS) {
      throw new ApiError(409, { code: 'REFRESH_TOKEN_ROTATED', message: 'Refresh session was just rotated. Retry with the latest cookie.' });
    }
    await prisma.refreshSession.updateMany({
      where: { userId: session.userId, revokedAt: null },
      data: { revokedAt: now },
    });
    throw new ApiError(401, { code: 'REFRESH_TOKEN_REUSED', message: 'Refresh token reuse was detected. Please sign in again.' });
  }
  if (session.expiresAt <= now) {
    await prisma.refreshSession.update({ where: { id: session.id }, data: { revokedAt: now } });
    throw new ApiError(401, { code: 'REFRESH_TOKEN_EXPIRED', message: 'Refresh session has expired.' });
  }

  const rotatedRefreshToken = await prisma.$transaction(async transaction => {
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

exports._private = { hashRefreshToken, signAccessToken };
