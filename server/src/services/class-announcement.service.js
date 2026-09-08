const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { sendNotificationToUser } = require('./notification.service');

const MAX_PINNED_ANNOUNCEMENTS = 5;
const userIdNumber = value => Number.parseInt(value, 10);
const normalizeTitle = value => {
  const title = String(value || '').trim().replace(/\s+/g, ' ');
  if (!title) throw new ApiError(400, { error: 'Announcement title is required.' });
  if (title.length > 160) throw new ApiError(400, { error: 'Announcement title must be 160 characters or fewer.' });
  return title;
};
const normalizeContent = value => {
  const content = String(value || '').trim();
  if (content.length > 20_000) throw new ApiError(400, { error: 'Announcement content is too long.' });
  return content || null;
};
const normalizePinned = value => {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new ApiError(400, { error: 'Pinned state must be true or false.' });
  return value;
};
const normalizeUrls = (value, label) => {
  if (!Array.isArray(value)) return [];
  if (value.length > 20) throw new ApiError(400, { error: `${label} can contain at most 20 items.` });
  return [...new Set(value.map(item => String(item || '').trim()).filter(Boolean))].map(item => {
    try {
      const url = new URL(item);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
      return item;
    } catch {
      throw new ApiError(400, { error: `${label} must contain valid http(s) URLs.` });
    }
  });
};

const getClassAccess = async ({ db, classId, userId, userRole }) => {
  const currentUserId = userIdNumber(userId);
  const classroom = await db.class.findUnique({
    where: { id: String(classId) },
    select: { id: true, name: true, teacherId: true, students: { select: { id: true } } },
  });
  if (!classroom) throw new ApiError(404, { error: 'Class not found.' });
  const canManage = userRole === 'ADMIN' || classroom.teacherId === currentUserId;
  const canRead = canManage || classroom.students.some(student => student.id === currentUserId);
  if (!canRead) throw new ApiError(403, { error: 'You do not have access to this class.' });
  return { classroom, currentUserId, canManage };
};

const assertPinCapacity = async ({ db, classId, excludeId }) => {
  const pinnedCount = await db.classAnnouncement.count({ where: {
    classId: String(classId), isPinned: true, ...(excludeId && { id: { not: String(excludeId) } }),
  } });
  if (pinnedCount >= MAX_PINNED_ANNOUNCEMENTS) throw new ApiError(400, { error: `A class can pin up to ${MAX_PINNED_ANNOUNCEMENTS} announcements.` });
};

async function listWithDb({ db, classId, userId, userRole }) {
  await getClassAccess({ db, classId, userId, userRole });
  return db.classAnnouncement.findMany({
    where: { classId: String(classId) },
    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, title: true, content: true, fileUrls: true, links: true, isPinned: true, createdAt: true, updatedAt: true, author: { select: { id: true, name: true } } },
  });
}

async function createWithDb({ db, classId, userId, userRole, data }) {
  const { classroom, currentUserId, canManage } = await getClassAccess({ db, classId, userId, userRole });
  if (!canManage) throw new ApiError(403, { error: 'Only the class teacher can publish announcements.' });
  const isPinned = normalizePinned(data?.isPinned) ?? false;
  if (isPinned) await assertPinCapacity({ db, classId: classroom.id });
  const announcement = await db.classAnnouncement.create({ data: {
    classId: classroom.id, authorId: currentUserId, title: normalizeTitle(data?.title), content: normalizeContent(data?.content),
    fileUrls: normalizeUrls(data?.fileUrls, 'Attachments'), links: normalizeUrls(data?.links, 'Links'), isPinned,
  } });
  if (db === prisma) await Promise.all(classroom.students.map(student => sendNotificationToUser(student.id, `New announcement in ${classroom.name}: "${announcement.title}"`, `/dashboard/class/${classroom.id}?tab=announcements&announcementId=${announcement.id}`)));
  return announcement;
}

async function updateWithDb({ db, classId, announcementId, userId, userRole, data }) {
  const existing = await db.classAnnouncement.findUnique({ where: { id: String(announcementId) }, select: { id: true, classId: true, isPinned: true } });
  if (!existing) throw new ApiError(404, { error: 'Announcement not found.' });
  if (existing.classId !== String(classId)) throw new ApiError(404, { error: 'Announcement not found.' });
  const { canManage } = await getClassAccess({ db, classId: existing.classId, userId, userRole });
  if (!canManage) throw new ApiError(403, { error: 'Only the class teacher can edit announcements.' });
  const isPinned = normalizePinned(data?.isPinned);
  if (isPinned && !existing.isPinned) await assertPinCapacity({ db, classId: existing.classId, excludeId: existing.id });
  return db.classAnnouncement.update({ where: { id: existing.id }, data: {
    ...(data?.title !== undefined && { title: normalizeTitle(data.title) }), ...(data?.content !== undefined && { content: normalizeContent(data.content) }),
    ...(data?.fileUrls !== undefined && { fileUrls: normalizeUrls(data.fileUrls, 'Attachments') }), ...(data?.links !== undefined && { links: normalizeUrls(data.links, 'Links') }),
    ...(isPinned !== undefined && { isPinned }),
  } });
}

async function removeWithDb({ db, classId, announcementId, userId, userRole }) {
  const existing = await db.classAnnouncement.findUnique({ where: { id: String(announcementId) }, select: { id: true, classId: true } });
  if (!existing) throw new ApiError(404, { error: 'Announcement not found.' });
  if (existing.classId !== String(classId)) throw new ApiError(404, { error: 'Announcement not found.' });
  const { canManage } = await getClassAccess({ db, classId: existing.classId, userId, userRole });
  if (!canManage) throw new ApiError(403, { error: 'Only the class teacher can delete announcements.' });
  await db.classAnnouncement.delete({ where: { id: existing.id } });
  return { deleted: true };
}

exports.list = params => listWithDb({ ...params, db: prisma });
exports.create = params => createWithDb({ ...params, db: prisma });
exports.update = params => updateWithDb({ ...params, db: prisma });
exports.remove = params => removeWithDb({ ...params, db: prisma });
exports.listWithDb = listWithDb;
exports.createWithDb = createWithDb;
exports.updateWithDb = updateWithDb;
