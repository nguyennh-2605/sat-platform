const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateToken } = require('../middleware/authMiddleware'); 

router.get('/', authenticateToken, analyticsController.getData);
router.get('/submission/:id', authenticateToken, analyticsController.getSubmissionDetail);

module.exports = router