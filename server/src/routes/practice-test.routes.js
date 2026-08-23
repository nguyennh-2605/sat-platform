const express = require('express')
const router = express.Router();
const practiceTestController = require('../controllers/practice-test.controller');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');

router.get('/classes', authenticateToken, practiceTestController.getClasses);
router.get('/taxonomy', authenticateToken, practiceTestController.getTaxonomy);
router.get('/:id/edit', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), practiceTestController.getTestForEdit);
router.get('/', authenticateToken, practiceTestController.getTests);
router.post('/assign', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), practiceTestController.assignTestsToClasses);
router.post('/create', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), practiceTestController.createTest);
router.put('/:id', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), practiceTestController.updateTest);
router.delete('/:id', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), practiceTestController.deleteTest);

module.exports = router;
