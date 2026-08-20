const express = require('express')
const router = express.Router();
const practiceTestController = require('../controllers/practice-test.controller');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');

router.get('/classes', authenticateToken, practiceTestController.getClasses);
router.get('/taxonomy', authenticateToken, practiceTestController.getTaxonomy);
router.get('/', authenticateToken, practiceTestController.getTests);
router.post('/assign', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), practiceTestController.assignTestsToClasses);
router.post('/create', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), practiceTestController.createTest);

module.exports = router;
