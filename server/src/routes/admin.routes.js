const express = require('express');
const controller = require('../controllers/admin-overview.controller');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');

const router = express.Router();
const adminOnly = authorizeRole(['ADMIN']);
const teacherAccess = require('../controllers/teacher-access.controller');
router.get('/teacher-access', authenticateToken, adminOnly, teacherAccess.list);
router.patch('/teacher-access/:requestId', authenticateToken, adminOnly, teacherAccess.review);

router.get('/overview', authenticateToken, adminOnly, controller.getOverview);
router.get('/overview/activity', authenticateToken, adminOnly, controller.getActivity);
router.get('/audit-events', authenticateToken, adminOnly, controller.getRecentActivity);

module.exports = router;
