const express = require('express');
const controller = require('../controllers/account.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/profile', authenticateToken, controller.getProfile);
router.patch('/profile', authenticateToken, controller.updateProfile);

module.exports = router;
