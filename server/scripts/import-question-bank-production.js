const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const {
  EXPECTED_DATASET_COUNT,
  importQuestionBankDataset,
  readQuestionBankDataset,
} = require('../src/services/question-bank-production-import.service');

const isLoopbackHost = hostname => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);

const main = async () => {
  const apply = process.argv.includes('--apply');
  const requireRender = process.argv.includes('--require-render');
  const dataset = readQuestionBankDataset();

  console.log(JSON.stringify({
    event: 'question_bank.production_import.validated',
    mode: apply ? 'apply' : 'dry-run',
    sourceCount: dataset.rows.length,
    expectedCount: EXPECTED_DATASET_COUNT,
    sha256: dataset.sha256,
    compressedBytes: dataset.compressedBytes,
    distribution: dataset.distribution,
  }));

  if (!apply) return;
  if (requireRender && process.env.RENDER !== 'true') {
    throw new Error('Refusing production import outside Render.');
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for production import.');

  const database = new URL(process.env.DATABASE_URL);
  if (isLoopbackHost(database.hostname)) {
    throw new Error('Refusing production import against a loopback database.');
  }

  const prisma = require('../src/config/prisma');
  const logger = require('../src/config/logger');
  try {
    const report = await importQuestionBankDataset({ prisma, logger });
    console.log(JSON.stringify({
      event: 'question_bank.production_import.completed',
      ...report,
    }));
  } finally {
    await prisma.$disconnect();
  }
};

main().catch(error => {
  console.error(JSON.stringify({
    event: 'question_bank.production_import.failed',
    message: error.message,
  }));
  process.exitCode = 1;
});
