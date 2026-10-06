const SOLUTION_DELIVERY_SELECT = {
  status: true,
  dueAt: true,
  activity: { select: { activity: { select: { type: true } } } },
};

const isSubmissionSolutionLocked = (submission, now = new Date()) => {
  // Every completed attempt releases its solutions immediately, regardless of
  // delivery type, deadline, or whether other students have finished.
  if (submission?.status === 'COMPLETED') return false;
  const delivery = submission?.delivery;
  if (!delivery || delivery.status !== 'PUBLISHED') return false;
  return !delivery.dueAt || new Date(delivery.dueAt) > now;
};

module.exports = { SOLUTION_DELIVERY_SELECT, isSubmissionSolutionLocked };
