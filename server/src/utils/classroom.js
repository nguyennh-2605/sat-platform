const CLASS_COLORS = Object.freeze([
  '#1B7A5A',
  '#0F4D38',
  '#2563EB',
  '#A16207',
  '#B45309',
  '#8B3A62',
  '#475569',
]);

const normalizeClassName = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const normalizeAssignmentType = (value) => value === 'announcement' ? 'announcement' : 'assignment';
const resolveAssignmentType = ({ type, deadline }) => deadline ? 'assignment' : normalizeAssignmentType(type);
const isAllowedClassColor = (value) => CLASS_COLORS.includes(String(value || '').toUpperCase());
const canManageClass = ({ teacherId, userId, userRole }) => userRole === 'ADMIN' || Number(teacherId) === Number(userId);

module.exports = { CLASS_COLORS, normalizeClassName, normalizeAssignmentType, resolveAssignmentType, isAllowedClassColor, canManageClass };
