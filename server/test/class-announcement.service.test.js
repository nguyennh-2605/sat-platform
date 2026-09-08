const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../src/services/class-announcement.service');

test('the owning teacher can publish a normalized class announcement', async () => {
  let createdData;
  const db = {
    class: { findUnique: async () => ({ id: 'class-1', name: 'SAT 1400', teacherId: 7, students: [{ id: 11 }] }) },
    classAnnouncement: {
      count: async () => 2,
      create: async ({ data }) => { createdData = data; return { id: 'announcement-1', ...data }; },
    },
  };
  const result = await service.createWithDb({
    db, classId: 'class-1', userId: 7, userRole: 'TEACHER',
    data: { title: '  Schedule   update  ', content: '<p><strong>Room 204</strong></p>', links: ['https://example.com/notes'], isPinned: true },
  });
  assert.equal(result.title, 'Schedule update');
  assert.equal(createdData.authorId, 7);
  assert.equal(createdData.isPinned, true);
  assert.equal(createdData.content, '<p><strong>Room 204</strong></p>');
  assert.deepEqual(createdData.links, ['https://example.com/notes']);
});

test('a class cannot pin more than five announcements', async () => {
  const db = {
    class: { findUnique: async () => ({ id: 'class-1', name: 'SAT 1400', teacherId: 7, students: [] }) },
    classAnnouncement: {
      count: async () => 5,
      create: async () => assert.fail('create must not be called'),
    },
  };
  await assert.rejects(
    service.createWithDb({ db, classId: 'class-1', userId: 7, userRole: 'TEACHER', data: { title: 'Important', isPinned: true } }),
    error => error.statusCode === 400 && error.body.error === 'A class can pin up to 5 announcements.',
  );
});

test('the owning teacher can unpin without consuming pin capacity', async () => {
  let updatedData;
  const db = {
    class: { findUnique: async () => ({ id: 'class-1', name: 'SAT 1400', teacherId: 7, students: [] }) },
    classAnnouncement: {
      findUnique: async () => ({ id: 'announcement-1', classId: 'class-1', isPinned: true }),
      count: async () => assert.fail('count must not be called when unpinning'),
      update: async ({ data }) => { updatedData = data; return { id: 'announcement-1', ...data }; },
    },
  };
  await service.updateWithDb({ db, classId: 'class-1', announcementId: 'announcement-1', userId: 7, userRole: 'TEACHER', data: { isPinned: false } });
  assert.equal(updatedData.isPinned, false);
});

test('an enrolled student cannot publish a class announcement', async () => {
  const db = {
    class: { findUnique: async () => ({ id: 'class-1', name: 'SAT 1400', teacherId: 7, students: [{ id: 11 }] }) },
    classAnnouncement: { create: async () => assert.fail('create must not be called') },
  };
  await assert.rejects(
    service.createWithDb({ db, classId: 'class-1', userId: 11, userRole: 'STUDENT', data: { title: 'No access' } }),
    error => error.statusCode === 403,
  );
});
