const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

const DASHBOARD_BACKGROUNDS = new Set([
  'default',
  'misty-hills',
  'mountain-forest',
  'quiet-pines',
  'woodland-mist',
  'evergreen-mist',
  'forest-clouds',
]);

const parseFutureDate = value => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw new ApiError(400, { error: 'Choose a valid SAT test date.' });
  }
  if (date.getTime() <= Date.now()) {
    throw new ApiError(400, { error: 'SAT test date must be in the future.' });
  }
  return date;
};

const assertStudent = role => {
  if (role !== 'STUDENT') throw new ApiError(403, { error: 'SAT countdown is available to students only.' });
};

exports.getSatTestDate = async ({ userId, userRole }) => {
  assertStudent(userRole);
  const user = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: { satTestDate: true },
  });
  if (!user) throw new ApiError(404, { error: 'User not found.' });
  return { satTestDate: user.satTestDate };
};

exports.updateSatTestDate = async ({ userId, userRole, satTestDate }) => {
  assertStudent(userRole);
  const date = parseFutureDate(satTestDate);
  const user = await prisma.user.update({
    where: { id: Number(userId) },
    data: { satTestDate: date },
    select: { satTestDate: true },
  });
  return { satTestDate: user.satTestDate };
};

exports.getDashboardBackground = async ({ userId }) => {
  const user = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: { dashboardBackground: true },
  });
  if (!user) throw new ApiError(404, { error: 'User not found.' });
  return { backgroundId: DASHBOARD_BACKGROUNDS.has(user.dashboardBackground) ? user.dashboardBackground : 'default' };
};

exports.updateDashboardBackground = async ({ userId, backgroundId }) => {
  const normalizedId = String(backgroundId || '').trim();
  if (!DASHBOARD_BACKGROUNDS.has(normalizedId)) {
    throw new ApiError(400, { error: 'Choose one of the available backgrounds.' });
  }
  const user = await prisma.user.update({
    where: { id: Number(userId) },
    data: { dashboardBackground: normalizedId },
    select: { dashboardBackground: true },
  });
  return { backgroundId: user.dashboardBackground };
};

exports.parseFutureDate = parseFutureDate;
exports.DASHBOARD_BACKGROUNDS = DASHBOARD_BACKGROUNDS;
