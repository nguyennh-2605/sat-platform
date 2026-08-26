const express = require('express');
const controller = require('../controllers/admin-overview.controller');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');

const router = express.Router();
const adminOnly = authorizeRole(['ADMIN']);

router.get('/overview', authenticateToken, adminOnly, controller.getOverview);
router.get('/overview/activity', authenticateToken, adminOnly, controller.getActivity);

module.exports = router;
