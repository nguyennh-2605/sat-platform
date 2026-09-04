require('dotenv').config();
const prisma = require('../src/config/prisma');
const { cleanupAssets } = require('../src/services/file-asset.service');

cleanupAssets()
  .then(result => console.log(`Cleaned ${result.processed} stale file asset(s).`))
  .catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
