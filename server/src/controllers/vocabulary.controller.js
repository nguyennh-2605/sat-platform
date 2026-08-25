const ApiError = require('../utils/ApiError');
const vocabularyService = require('../services/vocabulary.service');

const auth = req => ({ userId: req.user?.userId || req.user?.id, userRole: req.user?.role });
const handle = (res, error, fallback) => {
  if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
  console.error(fallback, error);
  return res.status(500).json({ error: fallback });
};
const action = (handler, fallback, status = 200) => async (req, res) => {
  try { return res.status(status).json(await handler(req)); }
  catch (error) { return handle(res, error, fallback); }
};

exports.listSets = action(req => vocabularyService.listSets({ ...req.query, ...auth(req) }), 'Unable to load vocabulary sets.');
exports.getSet = action(req => vocabularyService.getSet({ setId: req.params.setId, activityId: req.query.activityId, ...auth(req) }), 'Unable to load the vocabulary set.');
exports.createSet = action(req => vocabularyService.createSet({ data: req.body, ...auth(req) }), 'Unable to create the vocabulary set.', 201);
exports.updateSet = action(req => vocabularyService.updateSet({ setId: req.params.setId, data: req.body, ...auth(req) }), 'Unable to update the vocabulary set.');
exports.replaceTerms = action(req => vocabularyService.replaceTerms({ setId: req.params.setId, terms: req.body.terms, ...auth(req) }), 'Unable to update vocabulary terms.');
exports.updateTerm = action(req => vocabularyService.updateTerm({ setId: req.params.setId, termId: req.params.termId, data: req.body, ...auth(req) }), 'Unable to update the vocabulary term.');
exports.deleteSet = action(req => vocabularyService.deleteSet({ setId: req.params.setId, ...auth(req) }), 'Unable to delete the vocabulary set.');
exports.publishSet = action(req => vocabularyService.publishSet({ setId: req.params.setId, ...auth(req) }), 'Unable to publish the vocabulary set.');
exports.archiveSet = action(req => vocabularyService.archiveSet({ setId: req.params.setId, ...auth(req) }), 'Unable to archive the vocabulary set.');
exports.createSession = action(req => vocabularyService.createSession({ setId: req.params.setId, ...req.body, ...auth(req) }), 'Unable to start the study session.', 201);
exports.getSession = action(req => vocabularyService.getSession({ sessionId: req.params.sessionId, ...auth(req) }), 'Unable to load the study session.');
exports.answerQuestion = action(req => vocabularyService.answerQuestion({ sessionId: req.params.sessionId, questionId: req.params.questionId, ...req.body, ...auth(req) }), 'Unable to save the answer.');
exports.assignSet = action(req => vocabularyService.assignSet({ data: req.body, ...auth(req) }), 'Unable to assign the vocabulary set.', 201);
exports.listClassActivities = action(req => vocabularyService.listClassActivities({ classId: req.params.classId, ...auth(req) }), 'Unable to load vocabulary activities.');
exports.getActivity = action(req => vocabularyService.getActivity({ activityId: req.params.activityId, ...auth(req) }), 'Unable to load the vocabulary activity.');
exports.performance = action(req => vocabularyService.getActivityPerformance({ activityId: req.params.activityId, ...auth(req) }), 'Unable to load vocabulary performance.');
