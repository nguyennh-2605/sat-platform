const express = require('express');
const router = express.Router();
const progressController = require('../controllers/progress.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// Week routes
router.get('/class/:classId/weeks', authenticateToken, progressController.getWeeks);
router.get('/class/:classId/outline', authenticateToken, progressController.getOutline);
router.post('/class/:classId/weeks', authenticateToken, progressController.createWeek);
router.put('/class/:classId/weeks/reorder', authenticateToken, progressController.reorderWeeks);
router.put('/weeks/:weekId', authenticateToken, progressController.updateWeek);
router.delete('/weeks/:weekId', authenticateToken, progressController.deleteWeek);

// Lesson routes
router.post('/weeks/:weekId/lessons', authenticateToken, progressController.createLesson);
router.put('/weeks/:weekId/lessons/reorder', authenticateToken, progressController.reorderLessons);
router.put('/lessons/:lessonId', authenticateToken, progressController.updateLesson);
router.delete('/lessons/:lessonId', authenticateToken, progressController.deleteLesson);
router.put('/lessons/:lessonId/progress', authenticateToken, progressController.completeLesson);
router.get('/lessons/:lessonId/workspace', authenticateToken, progressController.getLessonWorkspace);
router.post('/lessons/:lessonId/blocks', authenticateToken, progressController.createLessonBlock);
router.put('/lessons/:lessonId/blocks/reorder', authenticateToken, progressController.reorderLessonBlocks);
router.patch('/lessons/:lessonId/blocks/:blockId', authenticateToken, progressController.updateLessonBlock);
router.delete('/lessons/:lessonId/blocks/:blockId', authenticateToken, progressController.deleteLessonBlock);
router.put('/lessons/:lessonId/blocks/:blockId/progress', authenticateToken, progressController.updateLessonBlockProgress);
router.get('/lessons/:lessonId/attendance', authenticateToken, progressController.getAttendance);
router.put('/lessons/:lessonId/attendance', authenticateToken, progressController.saveAttendance);

// File routes
router.post('/lessons/:lessonId/files', authenticateToken, progressController.addFiles);
router.put('/files/:fileId/progress', authenticateToken, progressController.openResource);
router.delete('/files/:fileId', authenticateToken, progressController.deleteFile);

// Assignment routes
router.post('/lessons/:lessonId/assignment', authenticateToken, progressController.createOrUpdateAssignment);
router.delete('/assignments/:assignmentId', authenticateToken, progressController.deleteAssignment);

module.exports = router;
