const service = require('../services/teacher-access.service');
const ApiError = require('../utils/ApiError');
const handle = method => async (req, res) => {
  try {
    return res.json(await service[method]({
      userId: req.user.userId,
      reason: req.body?.reason,
      status: req.query.status,
      cursor: req.query.cursor,
      decision: req.body?.decision,
      reviewNote: req.body?.reviewNote,
      requestId: req.params.requestId,
    }));
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    req.log?.error({ err: error }, 'Teacher access request failed');
    return res.status(500).json({ error: 'Unable to update teacher access. Please try again.' });
  }
};
exports.getMine = handle('getMine');
exports.submit = handle('submit');
exports.list = handle('list');
exports.review = handle('review');
