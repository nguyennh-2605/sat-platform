const express = require('express');
const controller = require('../controllers/account.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const teacherAccess = require('../controllers/teacher-access.controller');
const { createRateLimiter } = require('../middleware/rate-limit.middleware');
const requestLimit = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10, key: req => String(req.user.userId), message: 'Too many teacher access requests. Try again later.' });

const router = express.Router();

router.get('/profile', authenticateToken, controller.getProfile);
router.patch('/profile', authenticateToken, controller.updateProfile);
router.get('/teacher-access', authenticateToken, teacherAccess.getMine);
router.post('/teacher-access', authenticateToken, requestLimit, teacherAccess.submit);

module.exports = router;
