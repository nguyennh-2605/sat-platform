const express = require('express');
const router = express.Router();
const examRoomController = require('../controllers/exam-room.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.get('/:id/setup', authenticateToken, examRoomController.getTestSetup);
router.post('/:id/start', authenticateToken, examRoomController.startTest);
router.get('/:id', authenticateToken, examRoomController.startOrResumeTest);
router.post('/:id/begin', authenticateToken, examRoomController.beginTest);
router.post('/:id/pause', authenticateToken, examRoomController.pauseTest);
router.post('/:id/advance-module', authenticateToken, examRoomController.advanceModule);
router.post('/:id/save-progress', authenticateToken, examRoomController.saveProgress);
router.post('/:id/submit', authenticateToken, examRoomController.submitTest);

module.exports = router;
