const express = require('express');
const router = express.Router();
const examRoomController = require('../controllers/exam-room.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.get('/:id', authenticateToken, examRoomController.startOrResumeTest);
router.post('/:id/save-progress', authenticateToken, examRoomController.saveProgress);
router.post('/:id/submit', authenticateToken, examRoomController.submitTest);

module.exports = router;