const test = require('node:test');
const assert = require('node:assert/strict');
const { getProfile, normalizeProfileName, serializeProfile, updateProfile } = require('../src/services/account.service');

test('profile names are normalized and bounded', () => {
  assert.equal(normalizeProfileName('  Minh   Nguyễn  '), 'Minh Nguyễn');
  assert.throws(() => normalizeProfileName('   '), /required/);
  assert.throws(() => normalizeProfileName('a'.repeat(101)), /100 characters/);
});

test('profile serialization does not expose authentication secrets', () => {
  assert.deepEqual(serializeProfile({ id: 7, email: 'student@example.test', name: 'Student', role: 'STUDENT', avatar: null, googleSubject: 'google-id', password: 'secret' }), {
    id: 7,
    email: 'student@example.test',
    name: 'Student',
    role: 'STUDENT',
    avatar: null,
    loginMethod: 'GOOGLE',
  });
});

test('profile reads and updates only the authenticated user id', async () => {
  let readId;
  let updateInput;
  const user = { id: 12, email: 'student@example.test', name: 'New Name', role: 'STUDENT', avatar: null, googleSubject: null };
  const db = {
    user: {
      findUnique: async input => { readId = input.where.id; return user; },
      update: async input => { updateInput = input; return user; },
    },
  };

  await getProfile({ userId: '12', db });
  await updateProfile({ userId: '12', name: ' New   Name ', db });

  assert.equal(readId, 12);
  assert.equal(updateInput.where.id, 12);
  assert.equal(updateInput.data.name, 'New Name');
});
