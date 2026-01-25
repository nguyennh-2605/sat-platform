const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController')
const { authenticateToken } = require('../middleware/authMiddleware'); // Middleware check login

// API lấy danh sách lớp (cho Sidebar)
router.get('/', authenticateToken, classController.getMyClasses);
// API tạo lớp mới
router.post('/', authenticateToken, classController.createClass);
// API lấy chi tiết 1 lớp (khi click vào lớp)
router.get('/:id', authenticateToken, classController.getClassDetail);
// API thêm học sinh vào lớp
router.post('/:classId/students', authenticateToken, classController.addStudentToClass);
router.post('/assignments', authenticateToken, classController.createAssignment);
router.post('/submissions', authenticateToken, classController.createSubmission);

module.exports = router;