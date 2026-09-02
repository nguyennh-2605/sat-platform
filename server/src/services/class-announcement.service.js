const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { sendNotificationToUser } = require('./notification.service');

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

async function listWithDb({ db, classId, userId, userRole }) {
  await getClassAccess({ db, classId, userId, userRole });
  return db.classAnnouncement.findMany({
    where: { classId: String(classId) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, title: true, content: true, fileUrls: true, links: true, createdAt: true, updatedAt: true, author: { select: { id: true, name: true } } },
  });
}

async function createWithDb({ db, classId, userId, userRole, data }) {
  const { classroom, currentUserId, canManage } = await getClassAccess({ db, classId, userId, userRole });
  if (!canManage) throw new ApiError(403, { error: 'Only the class teacher can publish announcements.' });
  const announcement = await db.classAnnouncement.create({ data: {
    classId: classroom.id, authorId: currentUserId, title: normalizeTitle(data?.title), content: normalizeContent(data?.content),
    fileUrls: normalizeUrls(data?.fileUrls, 'Attachments'), links: normalizeUrls(data?.links, 'Links'),
  } });
  if (db === prisma) await Promise.all(classroom.students.map(student => sendNotificationToUser(student.id, `New announcement in ${classroom.name}: "${announcement.title}"`, `/dashboard/class/${classroom.id}?tab=announcements&announcementId=${announcement.id}`)));
  return announcement;
}

async function updateWithDb({ db, classId, announcementId, userId, userRole, data }) {
  const existing = await db.classAnnouncement.findUnique({ where: { id: String(announcementId) }, select: { id: true, classId: true } });
  if (!existing) throw new ApiError(404, { error: 'Announcement not found.' });
  if (existing.classId !== String(classId)) throw new ApiError(404, { error: 'Announcement not found.' });
  const { canManage } = await getClassAccess({ db, classId: existing.classId, userId, userRole });
  if (!canManage) throw new ApiError(403, { error: 'Only the class teacher can edit announcements.' });
  return db.classAnnouncement.update({ where: { id: existing.id }, data: {
    ...(data?.title !== undefined && { title: normalizeTitle(data.title) }), ...(data?.content !== undefined && { content: normalizeContent(data.content) }),
    ...(data?.fileUrls !== undefined && { fileUrls: normalizeUrls(data.fileUrls, 'Attachments') }), ...(data?.links !== undefined && { links: normalizeUrls(data.links, 'Links') }),
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
