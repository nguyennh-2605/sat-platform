const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../src/services/class-announcement.service');

test('the owning teacher can publish a normalized class announcement', async () => {
  let createdData;
  const db = {
    class: { findUnique: async () => ({ id: 'class-1', name: 'SAT 1400', teacherId: 7, students: [{ id: 11 }] }) },
    classAnnouncement: {
      create: async ({ data }) => { createdData = data; return { id: 'announcement-1', ...data }; },
    },
  };
  const result = await service.createWithDb({
    db, classId: 'class-1', userId: 7, userRole: 'TEACHER',
    data: { title: '  Schedule   update  ', content: 'Room 204', links: ['https://example.com/notes'] },
  });
  assert.equal(result.title, 'Schedule update');
  assert.equal(createdData.authorId, 7);
  assert.deepEqual(createdData.links, ['https://example.com/notes']);
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
