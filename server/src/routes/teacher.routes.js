const express = require('express');
const controller = require('../controllers/teacher-overview.controller');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');

const router = express.Router();
const teacherOnly = authorizeRole(['TEACHER']);

router.get('/overview', authenticateToken, teacherOnly, controller.getOverview);
router.get('/overview/insights', authenticateToken, teacherOnly, controller.getInsights);

module.exports = router;
