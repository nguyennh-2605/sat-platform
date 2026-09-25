const express = require('express');
const router = express.Router();

// Import all route modules
const classRoutes = require('./class.routes');
const errorLogRoutes = require('./error-log.routes');
const analyticsRoutes = require('./analytics.routes');
const practiceTestRoutes = require('./practice-test.routes');
const examRoomRoutes = require('./exam-room.routes');
const testImportRoutes = require('./test-import.routes');
const notificationRoutes = require('./notification.routes');
const assignmentRoutes = require('./assignment.routes');
const testBankRoutes = require('./test-bank.routes');
const progressRoutes = require('./progress.routes');
const testDeliveryRoutes = require('./test-delivery.routes');
const userPreferenceRoutes = require('./user-preference.routes');
const vocabularyRoutes = require('./vocabulary.routes');
const classActivityRoutes = require('./class-activity.routes');
const adminRoutes = require('./admin.routes');
const studentRoutes = require('./student.routes');
const teacherRoutes = require('./teacher.routes');
const fileAssetRoutes = require('./file-asset.routes');
const testImageRoutes = require('./test-image.routes');
const studySessionRoutes = require('./study-session.routes');
const accountRoutes = require('./account.routes');

// Mount routes
router.use('/classes', classRoutes);
router.use('/error-logs', errorLogRoutes);
router.use('/results-analytics', analyticsRoutes);
router.use('/tests', practiceTestRoutes);
router.use('/test', examRoomRoutes);
router.use('/test-imports', testImportRoutes);
router.use('/notifications', notificationRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/bank', testBankRoutes);
router.use('/progress', progressRoutes);
router.use('/test-deliveries', testDeliveryRoutes);
router.use('/user-preferences', userPreferenceRoutes);
router.use('/vocabulary', vocabularyRoutes);
router.use('/class-activities', classActivityRoutes);
router.use('/admin', adminRoutes);
router.use('/student', studentRoutes);
router.use('/teacher', teacherRoutes);
router.use('/files', fileAssetRoutes);
router.use('/test-images', testImageRoutes);
router.use('/study-sessions', studySessionRoutes);
router.use('/account', accountRoutes);

module.exports = router;
