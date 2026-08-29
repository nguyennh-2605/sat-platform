const ApiError = require('../utils/ApiError');
const teacherOverviewService = require('../services/teacher-overview.service');

const respond = async (res, action, fallbackMessage) => {
  try {
    return res.json(await action());
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error(fallbackMessage, error);
    return res.status(500).json({ error: fallbackMessage });
  }
};

const userIdFor = req => req.user?.userId || req.user?.id;

exports.getOverview = (req, res) => respond(
  res,
  () => teacherOverviewService.getOverview({ userId: userIdFor(req), classId: req.query.classId }),
  'Unable to load the teacher overview.',
);

exports.getInsights = (req, res) => respond(
  res,
  () => teacherOverviewService.getInsights({ userId: userIdFor(req), classId: req.query.classId, range: req.query.range }),
  'Unable to load learning insights.',
);
