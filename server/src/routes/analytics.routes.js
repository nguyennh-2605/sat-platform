const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');

router.get('/', authenticateToken, authorizeRole(['STUDENT']), analyticsController.getData);
router.get('/submission/:id', authenticateToken, authorizeRole(['STUDENT']), analyticsController.getSubmissionDetail);

module.exports = router
