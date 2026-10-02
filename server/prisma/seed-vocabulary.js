const prisma = require('../src/config/prisma');
const sonderSatVocabulary = require('./data/sonder-sat-vocabulary.json');

const collections = [
  {
    id: 'sonder-sat-1000-most-common-words',
    title: sonderSatVocabulary.title,
    description: sonderSatVocabulary.description,
    sourceLanguage: sonderSatVocabulary.sourceLanguage,
    translationLanguage: sonderSatVocabulary.translationLanguage,
    publishedAt: new Date(sonderSatVocabulary.publishedAt),
    terms: sonderSatVocabulary.terms,
  },
];

const toTermData = (term, order) => {
  const value = Array.isArray(term)
    ? { word: term[0], meaning: term[1], translation: term[2], exampleSentence: term[3] }
    : term;
  return {
    word: value.word,
    normalizedWord: value.word.toLocaleLowerCase('en-US'),
    meaning: value.meaning,
    translation: value.translation,
    exampleSentence: value.exampleSentence || null,
    order,
  };
};

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
        data: {
          title: collection.title,
          description: collection.description,
          sourceLanguage: collection.sourceLanguage || 'en',
          translationLanguage: collection.translationLanguage || 'vi',
          status: 'PUBLISHED',
          publishedAt: collection.publishedAt,
        },
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
        sourceLanguage: collection.sourceLanguage || 'en',
        translationLanguage: collection.translationLanguage || 'vi',
        createdById: creator.id,
        publishedAt: collection.publishedAt,
        terms: {
          create: collection.terms.map(toTermData),
        },
      },
    });
  }
  console.log(`Seeded ${collections.length} vocabulary collections.`);
}

main()
  .catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
