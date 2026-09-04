const express = require('express');
const { authenticateToken } = require('../middleware/auth.middleware');
const { createRateLimiter } = require('../middleware/rate-limit.middleware');
const controller = require('../controllers/file-asset.controller');

const router = express.Router();
const uploadLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many upload requests. Please try again shortly.',
  key: req => `${req.user?.userId || req.user?.id || 'anonymous'}:${req.ip || 'unknown'}`,
});

router.post('/uploads', authenticateToken, uploadLimiter, controller.createUpload);
router.post('/:fileAssetId/complete', authenticateToken, uploadLimiter, controller.completeUpload);
router.get('/:fileAssetId/access', authenticateToken, controller.getAccessUrl);

module.exports = router;
