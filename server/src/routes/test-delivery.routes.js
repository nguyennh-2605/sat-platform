const express = require('express');
const controller = require('../controllers/test-delivery.controller');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');

const router = express.Router();
const staffOnly = authorizeRole(['TEACHER', 'ADMIN']);

router.post('/', authenticateToken, staffOnly, controller.create);
router.get('/class/:classId', authenticateToken, staffOnly, controller.listForClass);
router.get('/:deliveryId/performance', authenticateToken, staffOnly, controller.performance);
router.get('/:deliveryId/students/:studentId', authenticateToken, staffOnly, controller.studentPerformance);

module.exports = router;
