const express = require('express');
const router = express.Router();

// Import all route modules
const challengeRoutes = require('./challenge.routes');
const classRoutes = require('./class.routes');
const errorLogRoutes = require('./error-log.routes');
const analyticsRoutes = require('./analytics.routes');
const practiceTestRoutes = require('./practice-test.routes');
const examRoomRoutes = require('./exam-room.routes');
const aiChatBotRoutes = require('./ai-chatbot.routes');
const aiParserRoutes = require('./ai-parser.routes');
const notificationRoutes = require('./notification.routes');
const assignmentRoutes = require('./assignment.routes');
const testBankRoutes = require('./test-bank.routes');
const progressRoutes = require('./progress.routes');

// Mount routes
router.use('/challenge', challengeRoutes);
router.use('/classes', classRoutes);
router.use('/error-logs', errorLogRoutes);
router.use('/results-analytics', analyticsRoutes);
router.use('/tests', practiceTestRoutes);
router.use('/test', examRoomRoutes);
router.use('/ai', aiChatBotRoutes);
router.use('/ai-parser', aiParserRoutes);
router.use('/notifications', notificationRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/bank', testBankRoutes);
router.use('/progress', progressRoutes);

module.exports = router;
