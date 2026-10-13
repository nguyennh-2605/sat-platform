const express = require('express');
const router = express.Router();
const classController = require('../controllers/class.controller')
const classTodoController = require('../controllers/class-todo.controller');
const classAnnouncementController = require('../controllers/class-announcement.controller');
const classPerformanceController = require('../controllers/class-performance.controller');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware'); // Middleware check login
const { createRateLimiter } = require('../middleware/rate-limit.middleware');

// API lấy danh sách lớp (cho Sidebar)
router.get('/', authenticateToken, classController.getMyClasses);
router.post('/join', authenticateToken, authorizeRole(['STUDENT']), createRateLimiter({
  windowMs: 60_000, max: 10, key: req => String(req.user.userId || req.user.id),
  message: 'Too many join attempts. Please try again in a minute.',
}), classController.joinClass);
router.get('/todos', authenticateToken, classTodoController.list);
router.post('/todos/acknowledge', authenticateToken, classTodoController.acknowledge);
router.get('/list', authenticateToken, classController.getExamTests);
router.get('/:classId/announcements', authenticateToken, classAnnouncementController.list);
router.get('/:classId/performance', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), classPerformanceController.getPerformance);
router.patch('/:classId/follow-ups/:followUpId', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), classPerformanceController.updateFollowUp);
router.post('/:classId/announcements', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), classAnnouncementController.create);
router.patch('/:classId/announcements/:announcementId', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), classAnnouncementController.update);
router.delete('/:classId/announcements/:announcementId', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), classAnnouncementController.remove);
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
