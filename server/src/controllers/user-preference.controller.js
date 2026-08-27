const ApiError = require('../utils/ApiError');
const preferenceService = require('../services/user-preference.service');

const handleError = (res, error) => {
  if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
  console.error('Unable to update user preferences.', error);
  return res.status(500).json({ error: 'Unable to update user preferences.' });
};

exports.getSatTestDate = async (req, res) => {
  try {
    res.json(await preferenceService.getSatTestDate({
      userId: req.user?.userId || req.user?.id,
      userRole: req.user?.role || req.user?.userRole,
    }));
  } catch (error) {
    handleError(res, error);
  }
};

exports.updateSatTestDate = async (req, res) => {
  try {
    res.json(await preferenceService.updateSatTestDate({
      userId: req.user?.userId || req.user?.id,
      userRole: req.user?.role || req.user?.userRole,
      satTestDate: req.body?.satTestDate,
    }));
  } catch (error) {
    handleError(res, error);
  }
};

exports.getSatScoreGoal = async (req, res) => {
  try {
    res.json(await preferenceService.getSatScoreGoal({
      userId: req.user?.userId || req.user?.id,
      userRole: req.user?.role || req.user?.userRole,
    }));
  } catch (error) {
    handleError(res, error);
  }
};

exports.updateSatScoreGoal = async (req, res) => {
  try {
    res.json(await preferenceService.updateSatScoreGoal({
      userId: req.user?.userId || req.user?.id,
      userRole: req.user?.role || req.user?.userRole,
      currentScore: req.body?.currentScore,
      targetScore: req.body?.targetScore,
    }));
  } catch (error) {
    handleError(res, error);
  }
};

exports.getDashboardBackground = async (req, res) => {
  try {
    res.json(await preferenceService.getDashboardBackground({
      userId: req.user?.userId || req.user?.id,
    }));
  } catch (error) {
    handleError(res, error);
  }
};

exports.updateDashboardBackground = async (req, res) => {
  try {
    res.json(await preferenceService.updateDashboardBackground({
      userId: req.user?.userId || req.user?.id,
      backgroundId: req.body?.backgroundId,
    }));
  } catch (error) {
    handleError(res, error);
  }
};
