const hasAnswer = answer =>
  answer !== null && answer !== undefined && String(answer).trim() !== '';

const buildAttemptSummary = ({ questionCount, submission }) => {
  if (!submission) {
    return {
      progress: 0,
      isDoing: false,
      attemptStatus: 'NOT_STARTED',
      lastAttempt: null,
      lastScore: null
    };
  }

  const savedAnswers = submission.savedAnswers;
  const answeredCount = savedAnswers && typeof savedAnswers === 'object' && !Array.isArray(savedAnswers)
    ? Object.values(savedAnswers).filter(hasAnswer).length
    : 0;
  const progress = submission.status === 'COMPLETED'
    ? 100
    : questionCount > 0
      ? Math.min(99, Math.round((answeredCount / questionCount) * 100))
      : 0;

  return {
    progress,
    isDoing: submission.status === 'DOING',
    attemptStatus: submission.status,
    lastAttempt: submission.endTime || submission.beganAt || submission.startedAt || null,
    lastScore: submission.score ?? null
  };
};

module.exports = { buildAttemptSummary };
