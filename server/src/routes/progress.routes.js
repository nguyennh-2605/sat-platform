const express = require('express');
const router = express.Router();
const progressController = require('../controllers/progress.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// Week routes
router.get('/class/:classId/weeks', authenticateToken, progressController.getWeeks);
router.post('/class/:classId/weeks', authenticateToken, progressController.createWeek);
router.put('/weeks/:weekId', authenticateToken, progressController.updateWeek);
router.delete('/weeks/:weekId', authenticateToken, progressController.deleteWeek);

// Lesson routes
router.post('/weeks/:weekId/lessons', authenticateToken, progressController.createLesson);
router.put('/lessons/:lessonId', authenticateToken, progressController.updateLesson);
router.delete('/lessons/:lessonId', authenticateToken, progressController.deleteLesson);
router.put('/lessons/:lessonId/progress', authenticateToken, progressController.completeLesson);

// File routes
router.post('/lessons/:lessonId/files', authenticateToken, progressController.addFiles);
router.put('/files/:fileId/progress', authenticateToken, progressController.openResource);
router.delete('/files/:fileId', authenticateToken, progressController.deleteFile);

// Assignment routes
router.post('/lessons/:lessonId/assignment', authenticateToken, progressController.createOrUpdateAssignment);
router.delete('/assignments/:assignmentId', authenticateToken, progressController.deleteAssignment);

module.exports = router;
