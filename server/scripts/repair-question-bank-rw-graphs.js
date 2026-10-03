const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const prisma = require('../src/config/prisma');
const { repairQuestionBankRwGraphs } = require('../src/services/question-bank-rw-graph-repair.service');

const isLoopbackHost = hostname => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);

const main = async () => {
  const apply = process.argv.includes('--apply');
  const requireRender = process.argv.includes('--require-render');
  if (apply) {
    if (requireRender && process.env.RENDER !== 'true') throw new Error('Refusing production graph repair outside Render.');
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for graph repair.');
    const database = new URL(process.env.DATABASE_URL);
    if (isLoopbackHost(database.hostname)) throw new Error('Refusing graph repair against a loopback database.');
  }
  const report = await repairQuestionBankRwGraphs({ prisma, apply });
  console.log(JSON.stringify({ event: 'question_bank.rw_graph_repair.completed', ...report }));
};

main()
  .catch(error => {
    console.error(JSON.stringify({ event: 'question_bank.rw_graph_repair.failed', message: error.message }));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
