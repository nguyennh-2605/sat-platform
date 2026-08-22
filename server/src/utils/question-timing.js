const normalizeQuestionTimingSnapshot = ({ snapshot, questionIds, maxTotalMs }) => {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return {};

  const allowedIds = new Set((questionIds || []).map(Number));
  let remainingMs = Math.max(0, Math.floor(Number(maxTotalMs) || 0));
  const normalized = {};

  for (const [rawQuestionId, rawTiming] of Object.entries(snapshot)) {
    const questionId = Number(rawQuestionId);
    if (!Number.isInteger(questionId) || !allowedIds.has(questionId)) continue;
    if (!rawTiming || typeof rawTiming !== 'object' || Array.isArray(rawTiming)) continue;

    const requestedMs = Math.max(0, Math.floor(Number(rawTiming.activeDurationMs) || 0));
    const activeDurationMs = Math.min(requestedMs, remainingMs);
    const visitCount = Math.min(1000, Math.max(1, Math.floor(Number(rawTiming.visitCount) || 1)));

    normalized[String(questionId)] = { activeDurationMs, visitCount };
    remainingMs -= activeDurationMs;
    if (remainingMs <= 0) break;
  }

  return normalized;
};

const timingRowsFromSnapshot = ({ submissionId, snapshot }) => Object.entries(snapshot || {}).map(
  ([questionId, timing]) => ({
    submissionId: Number(submissionId),
    questionId: Number(questionId),
    activeDurationMs: Number(timing.activeDurationMs),
    visitCount: Number(timing.visitCount),
  })
);

module.exports = { normalizeQuestionTimingSnapshot, timingRowsFromSnapshot };
