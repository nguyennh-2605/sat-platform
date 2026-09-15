const MIN_DURATION_MS = 5 * 60 * 1000;
const MAX_DURATION_MS = 4 * 60 * 60 * 1000;

const ACTIVITY_TYPES = new Set(['PRACTICE', 'VOCABULARY', 'ERROR_LOG', 'HOMEWORK', 'OTHER']);
const RESOURCE_TYPES = new Set(['TEST', 'VOCABULARY_SET', 'ASSIGNMENT']);

const cleanOptionalText = (value, field, maxLength) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new TypeError(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned) return null;
  if (cleaned.length > maxLength) throw new TypeError(`${field} must be ${maxLength} characters or fewer.`);
  return cleaned;
};

const normalizeStartInput = (input = {}) => {
  const plannedDurationMs = Number(input.plannedDurationMs);
  if (!Number.isInteger(plannedDurationMs) || plannedDurationMs < MIN_DURATION_MS || plannedDurationMs > MAX_DURATION_MS) {
    throw new TypeError('plannedDurationMs must be an integer between 5 and 240 minutes.');
  }

  const activityType = input.activityType || 'OTHER';
  if (!ACTIVITY_TYPES.has(activityType)) throw new TypeError('activityType is invalid.');

  const resourceType = input.resourceType || null;
  if (resourceType && !RESOURCE_TYPES.has(resourceType)) throw new TypeError('resourceType is invalid.');

  const resourceId = cleanOptionalText(input.resourceId, 'resourceId', 120);
  if ((resourceType && !resourceId) || (!resourceType && resourceId)) {
    throw new TypeError('resourceType and resourceId must be provided together.');
  }

  return {
    plannedDurationMs,
    activityType,
    resourceType,
    resourceId,
    label: cleanOptionalText(input.label, 'label', 120),
    clientMutationId: cleanOptionalText(input.clientMutationId, 'clientMutationId', 120),
  };
};

const normalizeExpectedVersion = (value) => {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) throw new TypeError('expectedVersion must be a positive integer.');
  return version;
};

const getElapsedMs = (session, now = new Date()) => {
  let elapsedMs = Math.max(0, Number(session.accumulatedMs) || 0);
  if (session.status === 'RUNNING' && session.lastResumedAt) {
    elapsedMs += Math.max(0, now.getTime() - new Date(session.lastResumedAt).getTime());
  }
  return Math.min(Math.max(0, Number(session.plannedDurationMs) || 0), elapsedMs);
};

const getAutomaticEndAt = (session) => {
  if (session.status !== 'RUNNING' || !session.lastResumedAt) return null;
  const remainingAtResume = Math.max(0, session.plannedDurationMs - session.accumulatedMs);
  return new Date(new Date(session.lastResumedAt).getTime() + remainingAtResume);
};

module.exports = {
  MIN_DURATION_MS,
  MAX_DURATION_MS,
  normalizeStartInput,
  normalizeExpectedVersion,
  getElapsedMs,
  getAutomaticEndAt,
};
