const ApiError = require('../utils/ApiError');
const fileAssetService = require('../services/file-asset.service');

const handle = (fallback, action) => async (req, res) => {
  try { return await action(req, res); }
  catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error(fallback, error);
    return res.status(500).json({ error: fallback });
  }
};

exports.createUpload = handle('Unable to prepare the file upload.', async (req, res) => {
  const data = await fileAssetService.createUpload({ ...req.body, ownerId: req.user.userId || req.user.id });
  return res.status(201).json({ success: true, data });
});

exports.completeUpload = handle('Unable to complete the file upload.', async (req, res) => {
  const data = await fileAssetService.completeUpload({ fileAssetId: req.params.fileAssetId, ownerId: req.user.userId || req.user.id });
  return res.json({ success: true, data });
});

exports.getAccessUrl = handle('Unable to open the file.', async (req, res) => {
  const data = await fileAssetService.getAccessUrl({ fileAssetId: req.params.fileAssetId, userId: req.user.userId || req.user.id, userRole: req.user.role });
  return res.json({ success: true, data });
});
