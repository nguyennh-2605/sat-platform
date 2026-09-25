const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

const normalizeProfileName = value => {
  if (typeof value !== 'string') throw new ApiError(400, { error: 'Enter a valid display name.' });
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) throw new ApiError(400, { error: 'Display name is required.' });
  if (name.length > 100) throw new ApiError(400, { error: 'Display name must be 100 characters or fewer.' });
  return name;
};

const profileSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  avatar: true,
  googleSubject: true,
};

const serializeProfile = user => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  avatar: user.avatar,
  loginMethod: user.googleSubject ? 'GOOGLE' : 'PASSWORD',
});

exports.getProfile = async ({ userId, db = prisma }) => {
  const user = await db.user.findUnique({
    where: { id: Number(userId) },
    select: profileSelect,
  });
  if (!user) throw new ApiError(404, { error: 'User not found.' });
  return serializeProfile(user);
};

exports.updateProfile = async ({ userId, name, db = prisma }) => {
  const user = await db.user.update({
    where: { id: Number(userId) },
    data: { name: normalizeProfileName(name) },
    select: profileSelect,
  });
  return serializeProfile(user);
};

exports.normalizeProfileName = normalizeProfileName;
exports.serializeProfile = serializeProfile;
