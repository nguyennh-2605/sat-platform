const prisma = require('../src/config/prisma');

const apply = process.argv.includes('--apply');
const requireRender = process.argv.includes('--require-render');

const main = async () => {
  if (requireRender && !process.env.RENDER) {
    throw new Error('This command must run inside Render.');
  }

  const before = await prisma.questionBankItem.groupBy({
    by: ['status'],
    where: { scope: 'SYSTEM' },
    _count: { _all: true },
  });
  const pending = before
    .filter(row => row.status !== 'PUBLISHED')
    .reduce((total, row) => total + row._count._all, 0);

  if (!apply) {
    console.log(JSON.stringify({
      event: 'question_bank.publish_all.preview',
      pending,
      statuses: before,
    }));
    return;
  }

  const result = await prisma.questionBankItem.updateMany({
    where: { scope: 'SYSTEM', status: { not: 'PUBLISHED' } },
    data: { status: 'PUBLISHED' },
  });
  const published = await prisma.questionBankItem.count({
    where: { scope: 'SYSTEM', status: 'PUBLISHED' },
  });

  console.log(JSON.stringify({
    event: 'question_bank.publish_all.completed',
    changed: result.count,
    published,
  }));
};

main()
  .catch(error => {
    console.error(JSON.stringify({ event: 'question_bank.publish_all.failed', message: error.message }));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
