const express = require('express');
const controller = require('../controllers/class-activity.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/class/:classId', authenticateToken, controller.listForClass);

module.exports = router;
