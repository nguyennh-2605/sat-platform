const express = require('express');
const router = express.Router();
const errorLogController = require('../controllers/errorLogController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, errorLogController.getErrorLogs);
router.post('/', authenticateToken, errorLogController.createErrorLog);
router.put('/:id', authenticateToken, errorLogController.updateErrorLog);
router.delete('/:id', authenticateToken, errorLogController.deleteErrorLog);

module.exports = router;