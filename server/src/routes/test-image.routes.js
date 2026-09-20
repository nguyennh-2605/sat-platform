const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');
const { createRateLimiter } = require('../middleware/rate-limit.middleware');
const controller = require('../controllers/test-image.controller');

const router = express.Router();
const uploadLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many image uploads. Please try again shortly.',
  key: req => `${req.user?.userId || req.user?.id || 'anonymous'}:${req.ip || 'unknown'}`,
});

router.post('/uploads', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), uploadLimiter, controller.createUpload);
router.post('/:fileAssetId/complete', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), uploadLimiter, controller.completeUpload);
router.get('/:fileAssetId/access', authenticateToken, controller.getAccessUrl);

module.exports = router;
