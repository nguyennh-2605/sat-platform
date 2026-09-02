const express = require('express');
const controller = require('../controllers/class-activity.controller');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/class/:classId', authenticateToken, controller.listForClass);
router.post('/homework', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), controller.createHomework);

module.exports = router;
