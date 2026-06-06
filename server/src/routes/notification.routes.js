const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.get('/stream', authenticateToken, notificationController.connectStream);
router.get('/', authenticateToken, notificationController.getNotifications);
router.put('/read-all', authenticateToken, notificationController.markAllAsRead);

module.exports = router;