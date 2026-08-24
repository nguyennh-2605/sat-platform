const normalizeId = value => Number(value);

const canManageProgress = ({ teacherId, userId, userRole }) => (
  userRole === 'ADMIN' || normalizeId(teacherId) === normalizeId(userId)
);

const canReadProgress = ({ teacherId, studentIds = [], userId, userRole }) => (
  canManageProgress({ teacherId, userId, userRole })
  || studentIds.some(studentId => normalizeId(studentId) === normalizeId(userId))
);

module.exports = { canManageProgress, canReadProgress };
