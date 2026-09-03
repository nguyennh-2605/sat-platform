const express = require('express');
const controller = require('../controllers/class-activity.controller');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/class/:classId', authenticateToken, controller.listForClass);
router.get('/class/:classId/results', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), controller.listResultsForClass);
router.post('/assignments', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), controller.createAssignment);
router.post('/homework', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), controller.createHomework);

module.exports = router;
