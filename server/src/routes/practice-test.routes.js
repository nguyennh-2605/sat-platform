const express = require('express')
const router = express.Router();
const practiceTestController = require('../controllers/practice-test.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.get('/classes', authenticateToken, practiceTestController.getClasses);
router.get('/', authenticateToken, practiceTestController.getTests);
router.post('/create', authenticateToken, practiceTestController.createTest);

module.exports = router;  