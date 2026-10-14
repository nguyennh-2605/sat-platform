const service = require('../services/feedback.service');
const ApiError = require('../utils/ApiError');

const handle = (method, responseStatus = 200) => async (req, res) => {
  try {
    const data = await service[method]({
      userId: req.user.userId,
      submissionId: req.body?.submissionId, level: method === 'list' ? req.query.level : req.body?.level,
      message: req.body?.message, pagePath: req.body?.pagePath, attachmentIds: req.body?.attachmentIds,
      status: method === 'list' ? req.query.status : req.body?.status,
      expectedStatus: req.body?.expectedStatus, cursor: req.query.cursor,
      feedbackId: req.params.feedbackId, fileAssetId: req.params.fileAssetId, file: req.file,
    });
    return res.status(responseStatus).json(data);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    req.log?.error({ err: error }, 'Feedback request failed');
    return res.status(500).json({ error: 'Unable to process feedback. Please try again.' });
  }
};
exports.submit = handle('submit', 201);
exports.uploadImage = handle('uploadImage', 201);
exports.getImage = handle('getImage');
exports.list = handle('list');
exports.review = handle('review');
