const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const prisma = require('../src/config/prisma');
const { repairQuestionBankMathGraphs } = require('../src/services/question-bank-math-graph-repair.service');

const isLoopbackHost = hostname => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);

const main = async () => {
  const apply = process.argv.includes('--apply');
  const requireRender = process.argv.includes('--require-render');
  if (apply) {
    if (requireRender && process.env.RENDER !== 'true') throw new Error('Refusing production repair outside Render.');
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for production repair.');
    if (isLoopbackHost(new URL(process.env.DATABASE_URL).hostname)) throw new Error('Refusing production repair against a loopback database.');
  }
  const report = await repairQuestionBankMathGraphs({ prisma, apply });
  console.log(JSON.stringify({ event: 'question_bank.math_graph_repair.completed', ...report }));
};

main()
  .catch(error => {
    console.error(JSON.stringify({ event: 'question_bank.math_graph_repair.failed', message: error.message }));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
