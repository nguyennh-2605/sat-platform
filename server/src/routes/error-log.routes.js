const express = require('express');
const router = express.Router();
const errorLogController = require('../controllers/error-log.controller');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');
const { createRateLimiter } = require('../middleware/rate-limit.middleware');

const ERROR_LOG_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const googleSheetExportLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  key: req => `student:${req.user.userId}`,
  message: 'Too many Google Sheets exports. Please try again shortly.',
});

router.use(authenticateToken, authorizeRole(['STUDENT']));
router.param('id', (req, res, next, id) => {
  if (!ERROR_LOG_ID_PATTERN.test(id)) {
    return res.status(400).json({ message: 'Invalid error log ID.' });
  }
  return next();
});

router.get('/', errorLogController.getErrorLogs);
router.get('/facets', errorLogController.getErrorLogFacets);
router.post('/export/google-sheet', googleSheetExportLimiter, errorLogController.exportGoogleSheet);
router.post('/', errorLogController.createErrorLog);
router.get('/:id/question', errorLogController.getErrorLogQuestion);
router.patch('/:id', errorLogController.updateErrorLog);
router.put('/:id', (req, res, next) => {
  res.set('Deprecation', 'true');
  res.set('Warning', '299 - "PUT /api/error-logs/:id is deprecated; use PATCH"');
  return errorLogController.updateErrorLog(req, res, next);
});
router.delete('/:id', errorLogController.deleteErrorLog);

module.exports = router;
