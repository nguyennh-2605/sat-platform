const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const dictionaryService = require('./dictionary.service');
const { lockVocabularyUser } = require('./vocabulary-scheduler.service');
const { _private: { sessionResponse, normalizeWord, shuffle } } = require('./vocabulary.service');

const DAILY_REVIEW_LIMIT = 20;
const DAILY_NEW_LIMIT = 10;
const DAY_MS = 86_400_000;
const termAccess = userId => ({ meaning: { not: '' }, set: { status: { not: 'ARCHIVED' }, OR: [{ scope: 'SYSTEM', status: 'PUBLISHED' }, { scope: 'PERSONAL', ownerId: userId }] } });
const dueFilter = (userId, now) => ({ progress: { some: { userId, OR: [{ dueAt: { lte: now } }, { dueAt: null, seenCount: { gt: 0 } }] } } });
const newFilter = userId => ({ progress: { none: { userId, OR: [{ seenCount: { gt: 0 } }, { dueAt: { not: null } }] } } });
const sessionInclude = { questions: { orderBy: { order: 'asc' }, include: { reviewLog: { select: { nextDueAt: true } } } } };
const validateUser = value => { const id = Number(value); if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(401, { error: 'Sign in to study vocabulary.' }); return id; };
const validateTimezone = value => {
  const timezone = typeof value === 'string' && value.length <= 100 ? value : 'UTC';
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(); } catch { throw new ApiError(400, { error: 'Choose a valid timezone.' }); }
  return timezone;
};
const localDate = (date, timezone) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

function createPracticeService({ db = prisma, dictionary = dictionaryService.lookup, clock = () => new Date() } = {}) {
  async function overview({ userId: input, timezone: requestedTimezone }) {
    const userId = validateUser(input);
    const now = clock();
    const timezone = validateTimezone(requestedTimezone);
    const accessible = termAccess(userId);
    const [dueCount, newCount, scheduledCount, active, upcoming, logs] = await Promise.all([
      db.vocabularyTerm.count({ where: { ...accessible, ...dueFilter(userId, now) } }),
      db.vocabularyTerm.count({ where: { ...accessible, ...newFilter(userId) } }),
      db.vocabularyTermProgress.count({ where: { userId, dueAt: { gt: now }, term: accessible } }),
      db.vocabularyStudySession.findFirst({ where: { userId, isDaily: true, status: 'IN_PROGRESS' }, orderBy: { lastActivityAt: 'desc' }, include: sessionInclude }),
      db.vocabularyTermProgress.findFirst({ where: { userId, dueAt: { gt: now }, term: accessible }, orderBy: { dueAt: 'asc' }, select: { dueAt: true } }),
      // UTC +/- 24h bounds cover all IANA offsets; derive each learner's date
      // before counting, without trusting a browser-provided clock.
      db.vocabularyReviewLog.groupBy({ by: ['termId'], where: { userId, reviewedAt: { gte: new Date(now.getTime() - 2 * DAY_MS), lte: now } }, _max: { reviewedAt: true } }),
    ]);
    const today = localDate(now, timezone);
    const studiedToday = logs.filter(log => localDate(log._max.reviewedAt, timezone) === today).length;
    return { dueCount, newCount, scheduledCount, studiedToday, dailyReviewLimit: DAILY_REVIEW_LIMIT, dailyNewLimit: DAILY_NEW_LIMIT, nextDueAt: upcoming?.dueAt || null, activeSession: active ? { id: active.id, answeredCount: active.questions.filter(q => q.answeredAt).length, totalItems: active.totalItems } : null };
  }

  async function startDaily({ userId: input, focus = 'MIXED' }) {
    const userId = validateUser(input);
    if (!['MIXED', 'REVIEW', 'NEW'].includes(focus)) throw new ApiError(400, { error: 'Choose a valid practice mode.' });
    return db.$transaction(async tx => {
      await lockVocabularyUser(tx, userId);
      const active = await tx.vocabularyStudySession.findFirst({ where: { userId, isDaily: true, status: 'IN_PROGRESS' }, orderBy: { lastActivityAt: 'desc' }, include: sessionInclude });
      if (active) return sessionResponse(active);
      const now = clock();
      const accessible = termAccess(userId);
      const due = focus === 'NEW' ? [] : await tx.vocabularyTermProgress.findMany({ where: { userId, term: accessible, OR: [{ dueAt: { lte: now } }, { dueAt: null, seenCount: { gt: 0 } }] }, orderBy: [{ dueAt: { sort: 'asc', nulls: 'first' } }, { termId: 'asc' }], take: DAILY_REVIEW_LIMIT, include: { term: true } });
      const fresh = focus === 'REVIEW' ? [] : await tx.vocabularyTerm.findMany({ where: { ...accessible, ...newFilter(userId) }, orderBy: [{ set: { scope: 'desc' } }, { set: { createdAt: 'desc' } }, { order: 'asc' }, { id: 'asc' }], take: DAILY_NEW_LIMIT });
      const selected = [...due.map(row => ({ ...row.term, isNew: false })), ...fresh.map(term => ({ ...term, isNew: true }))];
      if (!selected.length) throw new ApiError(409, { code: 'NO_WORDS_DUE', error: focus === 'REVIEW' ? 'You are caught up. No words are due right now.' : 'No words are available for this practice. Save a word or choose a collection.' });
      const setIds = [...new Set(selected.map(term => term.setId))];
      const pool = await tx.vocabularyTerm.findMany({ where: { ...accessible, setId: { in: setIds } }, select: { meaning: true }, orderBy: { order: 'asc' }, take: 500 });
      const meanings = [...new Map(pool.map(term => [term.meaning.trim().toLowerCase(), term.meaning.trim()])).values()];
      const session = await tx.vocabularyStudySession.create({ data: {
        userId, setId: null, isDaily: true, mode: 'QUIZ', totalItems: selected.length,
        questions: { create: selected.map((term, order) => {
          const distractors = shuffle(meanings.filter(meaning => meaning.toLowerCase() !== term.meaning.trim().toLowerCase())).slice(0, 3);
          return { sourceTermId: term.id, prompt: term.word, correctMeaning: term.meaning, translation: term.translation, exampleSentence: null, dictionaryDefinition: term.dictionaryDefinition, order, options: !term.isNew && distractors.length === 3 ? shuffle([term.meaning, ...distractors]) : [] };
        }) },
      }, include: sessionInclude });
      return sessionResponse(session);
    });
  }

  async function saveWord({ userId: input, word: rawWord, setId }) {
    const userId = validateUser(input);
    const word = dictionaryService.normalizeWord(rawWord);
    const normalizedWord = normalizeWord(word);
    // Existing saves must still be idempotent when the dictionary is offline.
    // Validate a requested destination before making any external lookup.
    const destination = await db.vocabularySet.findFirst({ where: { scope: 'PERSONAL', ownerId: userId, ...(setId ? { id: String(setId), status: { not: 'ARCHIVED' } } : { autoKey: 'SAVED_WORDS' }) }, select: { id: true, title: true, status: true } });
    if (setId && !destination) throw new ApiError(404, { error: 'Choose one of your personal collections.' });
    const previous = destination ? await db.vocabularyTerm.findUnique({ where: { setId_normalizedWord: { setId: destination.id, normalizedWord } } }) : null;
    if (previous && destination.status !== 'ARCHIVED') return { termId: previous.id, setId: destination.id, setTitle: destination.title, word: previous.word, created: false };
    // Prefer the curated SAT library. No user-supplied definitions, passage,
    // question identifiers, URLs or original sentences are accepted here.
    const curated = previous || await db.vocabularyTerm.findFirst({ where: { normalizedWord, set: { scope: 'SYSTEM', status: 'PUBLISHED' } }, orderBy: { createdAt: 'asc' } });
    let meaning = curated?.meaning;
    let translation = curated?.translation || '';
    let dictionaryDefinition = Boolean(curated?.dictionaryDefinition);
    if (!meaning) {
      const result = await dictionary(word);
      meaning = result.entries.flatMap(entry => entry.senses)[0]?.definition;
      if (!result.found || !meaning) throw new ApiError(422, { error: 'No definition was found. Add this word manually in Vocabulary.' });
      dictionaryDefinition = true;
    }
    return db.$transaction(async tx => {
      await lockVocabularyUser(tx, userId);
      let set;
      if (setId) {
        set = await tx.vocabularySet.findFirst({ where: { id: String(setId), scope: 'PERSONAL', ownerId: userId, status: { not: 'ARCHIVED' } } });
        if (!set) throw new ApiError(404, { error: 'Choose one of your personal collections.' });
      } else {
        set = await tx.vocabularySet.upsert({ where: { ownerId_autoKey: { ownerId: userId, autoKey: 'SAVED_WORDS' } }, update: { status: 'PUBLISHED' }, create: { title: 'Saved words', scope: 'PERSONAL', status: 'PUBLISHED', ownerId: userId, createdById: userId, autoKey: 'SAVED_WORDS', publishedAt: clock() } });
      }
      await tx.$queryRaw`SELECT "id" FROM "VocabularySet" WHERE "id" = ${set.id} FOR UPDATE`;
      const existing = await tx.vocabularyTerm.findUnique({ where: { setId_normalizedWord: { setId: set.id, normalizedWord } } });
      if (existing) return { termId: existing.id, setId: set.id, setTitle: set.title, word: existing.word, created: false };
      const last = await tx.vocabularyTerm.findFirst({ where: { setId: set.id }, orderBy: { order: 'desc' }, select: { order: true } });
      const term = await tx.vocabularyTerm.create({ data: { setId: set.id, word, normalizedWord, meaning: meaning.trim().slice(0, 500), translation: translation.trim().slice(0, 300), exampleSentence: null, dictionaryDefinition, order: (last?.order ?? -1) + 1 } });
      await tx.vocabularySet.update({ where: { id: set.id }, data: { version: { increment: 1 }, updatedAt: clock() } });
      return { termId: term.id, setId: set.id, setTitle: set.title, word: term.word, created: true };
    });
  }

  async function undoSave({ userId: input, termId }) {
    const userId = validateUser(input);
    return db.$transaction(async tx => {
      await lockVocabularyUser(tx, userId);
      const term = await tx.vocabularyTerm.findFirst({ where: { id: String(termId), set: { scope: 'PERSONAL', ownerId: userId } }, include: { _count: { select: { progress: true, sessionQuestions: true } } } });
      if (!term) throw new ApiError(404, { error: 'Saved word not found.' });
      if (term._count.progress || term._count.sessionQuestions) throw new ApiError(409, { error: 'This word is already part of a study session. Manage it in your collection.' });
      await tx.vocabularyTerm.delete({ where: { id: term.id } });
      await tx.vocabularySet.update({ where: { id: term.setId }, data: { version: { increment: 1 } } });
      return { removed: true };
    });
  }
  return { overview, startDaily, saveWord, undoSave };
}

module.exports = { ...createPracticeService(), createPracticeService, _private: { termAccess, dueFilter, newFilter, validateTimezone, localDate } };
