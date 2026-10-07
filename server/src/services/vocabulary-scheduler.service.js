const { createEmptyCard, fsrs, Rating, State } = require('ts-fsrs');

const scheduler = fsrs({ request_retention: 0.9, enable_fuzz: true, learning_steps: ['1m', '10m'], relearning_steps: ['10m'] });
const json = value => JSON.parse(JSON.stringify(value));

const scheduleProgress = (progress, correct, now = new Date()) => {
  // Aggregate legacy counts cannot reconstruct review history. Start FSRS on
  // the next real answer, preserving all existing coverage/accuracy counters.
  const previous = progress?.fsrsLastReview ? {
    due: progress.dueAt || now,
    stability: progress.fsrsStability,
    difficulty: progress.fsrsDifficulty,
    state: progress.fsrsState,
    reps: progress.fsrsReps,
    lapses: progress.fsrsLapses,
    learning_steps: progress.fsrsLearningSteps,
    scheduled_days: progress.fsrsScheduledDays,
    elapsed_days: progress.fsrsElapsedDays,
    last_review: progress.fsrsLastReview,
  } : createEmptyCard(now);
  const rating = correct ? Rating.Good : Rating.Again;
  const { card } = scheduler.next(previous, now, rating);
  return {
    data: {
      dueAt: card.due, fsrsStability: card.stability, fsrsDifficulty: card.difficulty,
      fsrsState: card.state, fsrsReps: card.reps, fsrsLapses: card.lapses,
      fsrsLearningSteps: card.learning_steps, fsrsScheduledDays: card.scheduled_days,
      fsrsElapsedDays: card.elapsed_days, fsrsLastReview: card.last_review,
      mastery: correct && card.state === State.Review ? 'MASTERED' : 'LEARNING',
    },
    log: { rating, reviewedAt: now, nextDueAt: card.due, previousState: json(previous), nextState: json(card) },
  };
};

// Sharing this lock serializes answers, daily-session creation and save/undo
// for one learner without blocking different learners.
const lockVocabularyUser = (tx, userId) => tx.$executeRaw`SELECT pg_advisory_xact_lock(4021, ${userId}::integer)`;

module.exports = { scheduleProgress, lockVocabularyUser };
