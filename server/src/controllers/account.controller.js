const ApiError = require('../utils/ApiError');
const accountService = require('../services/account.service');

const handleError = (res, error) => {
  if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
  console.error('Unable to update account profile.', error);
  return res.status(500).json({ error: 'Unable to update account profile.' });
};

exports.getProfile = async (req, res) => {
  try {
    return res.json(await accountService.getProfile({ userId: req.user?.userId || req.user?.id }));
  } catch (error) {
    return handleError(res, error);
  }
};

exports.updateProfile = async (req, res) => {
  try {
    return res.json(await accountService.updateProfile({
      userId: req.user?.userId || req.user?.id,
      name: req.body?.name,
    }));
  } catch (error) {
    return handleError(res, error);
  }
};
