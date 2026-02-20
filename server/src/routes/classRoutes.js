const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController')
const { authenticateToken } = require('../middleware/authMiddleware'); // Middleware check login

// API lấy danh sách lớp (cho Sidebar)
router.get('/', authenticateToken, classController.getMyClasses);
router.get('/list', authenticateToken, classController.getExamTests);
router.get('/:id', authenticateToken, classController.getClassDetail);
router.get('/:testId/report', authenticateToken, classController.getTestAnalytics);
router.post('/', authenticateToken, classController.createClass);
router.post('/:classId/students', authenticateToken, classController.addStudentToClass);
router.post('/assignments', authenticateToken, classController.createAssignment);
router.post('/submissions', authenticateToken, classController.createSubmission);

module.exports = router;