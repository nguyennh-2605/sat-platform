require('dotenv').config();
const prisma = require('../src/config/prisma');

async function main() {
  const answers = await prisma.answer.findMany({
    select: {
      id: true,
      selectedChoice: true,
      isCorrect: true,
      question: {
        select: { correctAnswer: true },
      },
    },
  });

  let updatedCount = 0;

  for (const answer of answers) {
    const shouldBeCorrect = answer.selectedChoice === answer.question.correctAnswer;

    if (answer.isCorrect !== shouldBeCorrect) {
      await prisma.answer.update({
        where: { id: answer.id },
        data: { isCorrect: shouldBeCorrect },
      });
      updatedCount++;
    }
  }

  console.log(`Backfilled ${updatedCount} / ${answers.length} answers.`);
}

main()
  .catch((error) => {
    console.error('Failed to backfill answer correctness:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
