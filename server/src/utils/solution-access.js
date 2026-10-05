const SOLUTION_DELIVERY_SELECT = {
  status: true,
  dueAt: true,
  activity: { select: { activity: { select: { type: true } } } },
};

const isSubmissionSolutionLocked = (submission, now = new Date()) => {
  const delivery = submission?.delivery;
  if (!delivery || delivery.status !== 'PUBLISHED') return false;
  if (submission.status === 'COMPLETED' && delivery.activity?.activity?.type === 'QUIZ') return false;
  return !delivery.dueAt || new Date(delivery.dueAt) > now;
};

module.exports = { SOLUTION_DELIVERY_SELECT, isSubmissionSolutionLocked };
