const express = require('express');
const { createHealthHandlers } = require('../controllers/health.controller');

const router = express.Router();
const handlers = createHealthHandlers();

router.get('/health', handlers.liveness);
router.get('/ready', handlers.readiness);

module.exports = router;
