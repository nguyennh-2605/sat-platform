const ApiError = require('../utils/ApiError');
const service = require('../services/test-image.service');

const handle = action => async (req, res) => {
  try { return await action(req, res); }
  catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Test image request failed:', error);
    return res.status(500).json({ error: 'Unable to process this test image.' });
  }
};

exports.createUpload = handle(async (req, res) => {
  const data = await service.createUpload({ ...req.body, ownerId: req.user.userId || req.user.id, userRole: req.user.role });
  return res.status(201).json({ success: true, data });
});

exports.completeUpload = handle(async (req, res) => {
  const data = await service.completeUpload({ fileAssetId: req.params.fileAssetId, ownerId: req.user.userId || req.user.id });
  return res.json({ success: true, data });
});

exports.getAccessUrl = handle(async (req, res) => {
  const data = await service.getAccessUrl({ fileAssetId: req.params.fileAssetId, userId: req.user.userId || req.user.id, userRole: req.user.role });
  return res.json({ success: true, data });
});
