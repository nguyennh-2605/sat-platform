const express = require('express');
const controller = require('../controllers/dictionary.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { createRateLimiter } = require('../middleware/rate-limit.middleware');

const router = express.Router();
const rateLimit = createRateLimiter({ windowMs: 60_000, max: 60, key: req => String(req.user.userId), message: 'Too many dictionary lookups. Please try again shortly.' });
router.get('/en/:word', authenticateToken, rateLimit, controller.lookup);
module.exports = router;
