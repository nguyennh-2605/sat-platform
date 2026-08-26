const express = require('express')
const router = express.Router();
const practiceTestController = require('../controllers/practice-test.controller');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');

router.get('/classes', authenticateToken, practiceTestController.getClasses);
router.get('/taxonomy', authenticateToken, practiceTestController.getTaxonomy);
router.get('/:id/edit', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), practiceTestController.getTestForEdit);
router.get('/:id/content', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), practiceTestController.getTestContent);
router.get('/', authenticateToken, practiceTestController.getTests);
router.post('/create', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), practiceTestController.createTest);
router.post('/:id/duplicate', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), practiceTestController.duplicateTest);
router.patch('/:id/status', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), practiceTestController.updateTestStatus);
router.put('/:id', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), practiceTestController.updateTest);
router.delete('/:id', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), practiceTestController.deleteTest);

module.exports = router;
