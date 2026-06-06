const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { authenticateToken } = require('../middleware/auth.middleware'); 

router.get('/', authenticateToken, analyticsController.getData);
router.get('/submission/:id', authenticateToken, analyticsController.getSubmissionDetail);

module.exports = router