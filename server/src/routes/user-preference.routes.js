const express = require('express');
const controller = require('../controllers/user-preference.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/sat-test-date', authenticateToken, controller.getSatTestDate);
router.put('/sat-test-date', authenticateToken, controller.updateSatTestDate);
router.get('/sat-score-goal', authenticateToken, controller.getSatScoreGoal);
router.put('/sat-score-goal', authenticateToken, controller.updateSatScoreGoal);
router.get('/dashboard-background', authenticateToken, controller.getDashboardBackground);
router.put('/dashboard-background', authenticateToken, controller.updateDashboardBackground);

module.exports = router;
