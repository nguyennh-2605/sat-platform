require('dotenv').config();
const prisma = require('../src/config/prisma');
const { cleanupAssets } = require('../src/services/file-asset.service');

const startedAt = new Date();
console.log(JSON.stringify({ event: 'storage.cleanup.started', startedAt: startedAt.toISOString() }));

cleanupAssets()
  .then(result => console.log(JSON.stringify({
    event: 'storage.cleanup.completed',
    ...result,
  })))
  .catch(error => {
    console.error(JSON.stringify({
      event: 'storage.cleanup.failed',
      errorName: error?.name,
      errorCode: error?.Code || error?.code,
      durationMs: Date.now() - startedAt.getTime(),
    }));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
