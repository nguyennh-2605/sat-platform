const ApiError = require('../utils/ApiError');
const classPerformanceService = require('../services/class-performance.service');
const learningFollowUpService = require('../services/learning-follow-up.service');

const handleError = (res, error, fallback) => {
  if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
  console.error(fallback, error);
  return res.status(500).json({ error: fallback });
};

exports.getPerformance = async (req, res) => {
  try {
    const result = await classPerformanceService.getClassPerformance({
      classId: req.params.classId,
      userId: req.user.userId,
      userRole: req.user.role,
      range: req.query.range,
    });
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load class performance.');
  }
};

exports.updateFollowUp = async (req, res) => {
  try {
    const result = await learningFollowUpService.updateFollowUp({
      classId: req.params.classId,
      followUpId: req.params.followUpId,
      userId: req.user.userId,
      userRole: req.user.role,
      status: req.body.status,
      resolutionNote: req.body.resolutionNote,
    });
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to update this follow-up.');
  }
};
