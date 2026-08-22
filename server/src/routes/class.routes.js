const express = require('express');
const router = express.Router();
const classController = require('../controllers/class.controller')
const classTodoController = require('../controllers/class-todo.controller');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware'); // Middleware check login

// API lấy danh sách lớp (cho Sidebar)
router.get('/', authenticateToken, classController.getMyClasses);
router.get('/todos', authenticateToken, classTodoController.list);
router.post('/todos/acknowledge', authenticateToken, classTodoController.acknowledge);
router.get('/list', authenticateToken, classController.getExamTests);
router.get('/:id/score-report', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), classController.getScoreReportAssignments);
router.get('/:testId/report', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), classController.getTestAnalytics);
router.get('/:id', authenticateToken, classController.getClassDetail);
router.post('/', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), classController.createClass);
router.patch('/:id', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), classController.updateClass);
router.delete('/:id', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), classController.deleteClass);
router.post('/:classId/students', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), classController.addStudentToClass);
router.delete('/:classId/students/:studentId', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), classController.removeStudentFromClass);
router.post('/posts', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), classController.createAssignment);
router.post('/submissions', authenticateToken, classController.createSubmission);

module.exports = router;
