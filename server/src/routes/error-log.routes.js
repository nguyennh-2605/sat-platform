const express = require('express');
const router = express.Router();
const errorLogController = require('../controllers/error-log.controller');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');

router.use(authenticateToken, authorizeRole(['STUDENT']));

router.get('/', errorLogController.getErrorLogs);
router.post('/', errorLogController.createErrorLog);
router.put('/:id', errorLogController.updateErrorLog);
router.delete('/:id', errorLogController.deleteErrorLog);

module.exports = router;
