const ApiError = require('../utils/ApiError');
const prisma = require('../config/prisma');

const AUDIT_ACTIONS = Object.freeze({
  USER_REGISTERED: 'USER_REGISTERED',
  TEST_CREATED: 'TEST_CREATED',
  TEST_PUBLISHED: 'TEST_PUBLISHED',
  TEST_ARCHIVED: 'TEST_ARCHIVED',
  TEST_MOVED_TO_DRAFT: 'TEST_MOVED_TO_DRAFT',
  TEST_DELETED: 'TEST_DELETED',
  TEST_COPIED_TO_SYSTEM: 'TEST_COPIED_TO_SYSTEM',
  CLASS_CREATED: 'CLASS_CREATED',
  CLASS_DELETED: 'CLASS_DELETED',
  CLASS_STUDENT_ADDED: 'CLASS_STUDENT_ADDED',
  CLASS_STUDENT_REMOVED: 'CLASS_STUDENT_REMOVED',
  TEST_ASSIGNED: 'TEST_ASSIGNED',
});

const actionDefinitions = Object.freeze({
  [AUDIT_ACTIONS.USER_REGISTERED]: { category: 'ACCOUNT', label: 'Registered an account', metadataKeys: ['authMethod'] },
  [AUDIT_ACTIONS.TEST_CREATED]: { category: 'CONTENT', label: 'Created a test', metadataKeys: ['scope', 'status', 'sourceTestId'] },
  [AUDIT_ACTIONS.TEST_PUBLISHED]: { category: 'CONTENT', label: 'Published a test', metadataKeys: ['scope'] },
  [AUDIT_ACTIONS.TEST_ARCHIVED]: { category: 'CONTENT', label: 'Archived a test', metadataKeys: ['scope'] },
  [AUDIT_ACTIONS.TEST_MOVED_TO_DRAFT]: { category: 'CONTENT', label: 'Moved a test to draft', metadataKeys: ['scope'] },
  [AUDIT_ACTIONS.TEST_DELETED]: { category: 'CONTENT', label: 'Deleted a test', metadataKeys: ['scope'] },
  [AUDIT_ACTIONS.TEST_COPIED_TO_SYSTEM]: { category: 'CONTENT', label: 'Copied a test to System Library', metadataKeys: ['sourceTestId'] },
  [AUDIT_ACTIONS.CLASS_CREATED]: { category: 'CLASSROOM', label: 'Created a classroom', metadataKeys: [] },
  [AUDIT_ACTIONS.CLASS_DELETED]: { category: 'CLASSROOM', label: 'Deleted a classroom', metadataKeys: [] },
  [AUDIT_ACTIONS.CLASS_STUDENT_ADDED]: { category: 'CLASSROOM', label: 'Added a student', metadataKeys: ['memberLabel'] },
  [AUDIT_ACTIONS.CLASS_STUDENT_REMOVED]: { category: 'CLASSROOM', label: 'Removed a student', metadataKeys: ['memberLabel'] },
  [AUDIT_ACTIONS.TEST_ASSIGNED]: { category: 'DELIVERY', label: 'Assigned a test', metadataKeys: ['testTitle', 'testCount', 'assigneeCount'] },
});

const safeText = (value, fallback, maxLength = 200) => {
  const normalized = String(value || '').trim();
  return (normalized || fallback).slice(0, maxLength);
};

const sanitizeMetadata = (action, metadata) => {
  const allowedKeys = actionDefinitions[action]?.metadataKeys || [];
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) || allowedKeys.length === 0) return undefined;
  const safe = {};
  for (const key of allowedKeys) {
    const value = metadata[key];
    if (typeof value === 'string') safe[key] = value.slice(0, 200);
    else if (typeof value === 'number' && Number.isFinite(value)) safe[key] = value;
    else if (typeof value === 'boolean') safe[key] = value;
  }
  return Object.keys(safe).length ? safe : undefined;
};

const actorFallback = role => role ? role.charAt(0) + role.slice(1).toLowerCase() : 'System';

const recordAuditEvent = async (database, event) => {
  const definition = actionDefinitions[event.action];
  if (!definition) throw new Error(`Unsupported audit action: ${event.action}`);

  const parsedActorUserId = Number(event.actorUserId);
  const actorUserId = event.actorUserId !== null
    && event.actorUserId !== undefined
    && Number.isInteger(parsedActorUserId)
    && parsedActorUserId > 0
    ? parsedActorUserId
    : null;
  let actorLabel = String(event.actorLabel || '').trim();
  let actorRole = event.actorRole || null;
  if (actorUserId && (!actorLabel || !actorRole)) {
    const actor = await database.user.findUnique({
      where: { id: actorUserId },
      select: { name: true, role: true },
    });
    actorLabel ||= String(actor?.name || '').trim();
    actorRole ||= actor?.role || null;
  }

  return database.auditEvent.create({
    data: {
      action: event.action,
      category: definition.category,
      actorUserId,
      actorLabel: safeText(actorLabel, actorFallback(actorRole), 120),
      actorRole,
      entityType: safeText(event.entityType, 'PLATFORM', 40).toUpperCase(),
      entityId: event.entityId === undefined || event.entityId === null ? null : safeText(event.entityId, '', 120),
      entityLabel: safeText(event.entityLabel, 'Platform item'),
      metadata: sanitizeMetadata(event.action, event.metadata),
    },
  });
};

const encodeCursor = event => Buffer.from(JSON.stringify({ createdAt: event.createdAt.toISOString(), id: event.id })).toString('base64url');

const decodeCursor = value => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
    const createdAt = new Date(parsed.createdAt);
    if (!parsed.id || Number.isNaN(createdAt.getTime())) throw new Error('Invalid cursor');
    return { id: String(parsed.id), createdAt };
  } catch {
    throw new ApiError(400, { error: 'Recent activity cursor is invalid.' });
  }
};

const eventHref = event => {
  if (event.action === AUDIT_ACTIONS.TEST_ASSIGNED) return `/dashboard/class/${event.entityId}?tab=activities`;
  if (event.entityType === 'CLASS' && event.action !== AUDIT_ACTIONS.CLASS_DELETED) return `/dashboard/class/${event.entityId}`;
  if (event.entityType === 'TEST' && event.action !== AUDIT_ACTIONS.TEST_DELETED) {
    const source = event.metadata?.scope === 'PERSONAL' ? 'TEACHER' : 'SYSTEM';
    return `/dashboard/practice-test?source=${source}&search=${encodeURIComponent(event.entityLabel)}`;
  }
  return null;
};

const eventDetail = event => {
  if (event.action === AUDIT_ACTIONS.USER_REGISTERED) {
    const role = event.actorRole ? event.actorRole.charAt(0) + event.actorRole.slice(1).toLowerCase() : 'User';
    return role;
  }
  if ([AUDIT_ACTIONS.CLASS_STUDENT_ADDED, AUDIT_ACTIONS.CLASS_STUDENT_REMOVED].includes(event.action)) {
    return `${event.metadata?.memberLabel || 'Student'} · ${event.entityLabel}`;
  }
  if (event.action === AUDIT_ACTIONS.TEST_ASSIGNED) {
    const testLabel = Number(event.metadata?.testCount) > 1
      ? `${event.metadata.testCount} tests`
      : event.metadata?.testTitle || 'Test';
    return `${testLabel} · ${event.entityLabel}`;
  }
  return event.entityLabel;
};

const toRecentActivityItem = event => ({
  id: event.id,
  action: event.action,
  category: event.category,
  label: actionDefinitions[event.action]?.label || 'Updated the platform',
  detail: eventDetail(event),
  actor: {
    id: event.actorUserId,
    label: event.actorLabel,
    role: event.actorRole,
  },
  href: eventHref(event),
  createdAt: event.createdAt.toISOString(),
});

const getRecentActivityWithDb = async ({ db, limit, cursor }) => {
  const requestedLimit = Number.parseInt(limit, 10);
  const take = Number.isInteger(requestedLimit) ? Math.min(20, Math.max(1, requestedLimit)) : 8;
  const decodedCursor = decodeCursor(cursor);
  const events = await db.auditEvent.findMany({
    where: {
      action: { in: Object.keys(actionDefinitions) },
      ...(decodedCursor ? {
        OR: [
          { createdAt: { lt: decodedCursor.createdAt } },
          { createdAt: decodedCursor.createdAt, id: { lt: decodedCursor.id } },
        ],
      } : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
  });
  const hasMore = events.length > take;
  const page = hasMore ? events.slice(0, take) : events;
  return {
    items: page.map(toRecentActivityItem),
    nextCursor: hasMore && page.length ? encodeCursor(page[page.length - 1]) : null,
  };
};

module.exports = {
  AUDIT_ACTIONS,
  actionDefinitions,
  decodeCursor,
  getRecentActivityWithDb,
  getRecentActivity: args => getRecentActivityWithDb({ db: prisma, ...args }),
  recordAuditEvent,
  sanitizeMetadata,
  toRecentActivityItem,
};
