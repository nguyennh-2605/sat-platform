const prisma = require('../src/config/prisma');

const collections = [
  {
    id: 'demo-official-sat-library',
    title: 'Official SAT Library',
    description: 'Essential academic words frequently encountered across SAT Reading and Writing passages.',
    publishedAt: new Date('2026-01-02T00:00:00.000Z'),
    terms: [
      ['ubiquitous', 'present, appearing, or found everywhere', 'phổ biến khắp nơi', 'Smartphones have become ubiquitous in modern life.'],
      ['ambiguous', 'open to more than one interpretation', 'mơ hồ', 'The final sentence was deliberately ambiguous.'],
      ['ephemeral', 'lasting for a very short time', 'ngắn ngủi', 'Online trends are often ephemeral.'],
      ['prolific', 'producing many works or results', 'sáng tác hoặc tạo ra nhiều', 'She was one of the most prolific writers of her generation.'],
      ['pragmatic', 'dealing with problems in a practical way', 'thực tế', 'They chose a pragmatic solution to the budget problem.'],
      ['scrutinize', 'to examine something very carefully', 'xem xét kỹ lưỡng', 'The researchers scrutinized every result.'],
      ['corroborate', 'to confirm that a statement is true', 'chứng thực', 'A second witness helped corroborate the account.'],
      ['inherent', 'existing as a natural or permanent quality', 'vốn có', 'Every method has inherent limitations.'],
      ['nuance', 'a subtle difference in meaning or expression', 'sắc thái', 'The translation preserves the nuance of the original.'],
      ['plausible', 'seeming reasonable or likely to be true', 'hợp lý, đáng tin', 'The scientist offered a plausible explanation.'],
    ],
  },
  {
    id: 'demo-high-frequency-verbs',
    title: 'High Frequency Verbs',
    description: 'High-utility verbs for understanding arguments, evidence, and author intent.',
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    terms: [
      ['mitigate', 'to make something less severe or harmful', 'giảm nhẹ', 'Trees can help mitigate the effects of urban heat.'],
      ['assert', 'to state something confidently and forcefully', 'khẳng định', 'The author asserts that the policy needs revision.'],
      ['concede', 'to admit that something is true or valid', 'thừa nhận', 'The critic concedes one strength of the proposal.'],
      ['refute', 'to prove that a claim is wrong', 'bác bỏ', 'The new evidence may refute the earlier theory.'],
      ['infer', 'to reach a conclusion from evidence', 'suy luận', 'Readers can infer her attitude from the final paragraph.'],
      ['substantiate', 'to provide evidence supporting a claim', 'chứng minh bằng bằng chứng', 'The data substantiate the researcher’s conclusion.'],
      ['underscore', 'to emphasize the importance of something', 'nhấn mạnh', 'The results underscore the need for further study.'],
      ['diminish', 'to make or become less important or intense', 'làm giảm', 'The discovery does not diminish her earlier contribution.'],
      ['elucidate', 'to make something clear by explaining it', 'làm sáng tỏ', 'The diagram helps elucidate the process.'],
      ['reconcile', 'to make two apparently conflicting ideas compatible', 'dung hòa', 'The theory attempts to reconcile both observations.'],
    ],
  },
];

async function main() {
  const creator = await prisma.user.findFirst({
    where: { role: { in: ['ADMIN', 'TEACHER'] } },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  if (!creator) throw new Error('Create an admin or teacher before seeding vocabulary collections.');

  for (const collection of collections) {
    const existing = await prisma.vocabularySet.findUnique({ where: { id: collection.id }, select: { id: true } });
    if (existing) {
      await prisma.vocabularySet.update({
        where: { id: collection.id },
        data: { title: collection.title, description: collection.description, status: 'PUBLISHED', publishedAt: collection.publishedAt },
      });
      continue;
    }
    await prisma.vocabularySet.create({
      data: {
        id: collection.id,
        title: collection.title,
        description: collection.description,
        scope: 'SYSTEM',
        status: 'PUBLISHED',
        createdById: creator.id,
        publishedAt: collection.publishedAt,
        terms: {
          create: collection.terms.map(([word, meaning, translation, exampleSentence], order) => ({
            word,
            normalizedWord: word.toLocaleLowerCase('en-US'),
            meaning,
            translation,
            exampleSentence,
            order,
          })),
        },
      },
    });
  }
  console.log(`Seeded ${collections.length} vocabulary collections.`);
}

main()
  .catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
