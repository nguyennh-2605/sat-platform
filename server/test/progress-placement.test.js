const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const schema = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8');

test('deleting a lesson unlinks assigned work instead of cascading into activity history', () => {
  assert.match(schema, /model TestDelivery[\s\S]*?lesson\s+Lesson\?[\s\S]*?onDelete:\s*SetNull/);
  assert.match(schema, /model ClassActivity[\s\S]*?lesson\s+Lesson\?[\s\S]*?onDelete:\s*SetNull/);
});
