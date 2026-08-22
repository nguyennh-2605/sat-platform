const express = require('express');
const controller = require('../controllers/user-preference.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/sat-test-date', authenticateToken, controller.getSatTestDate);
router.put('/sat-test-date', authenticateToken, controller.updateSatTestDate);

module.exports = router;
