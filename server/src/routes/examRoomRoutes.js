const express = require('express');
const router = express.Router();
const examRoomController = require('../controllers/examRoomController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/:id', authenticateToken, examRoomController.startOrResumeTest);
router.post('/:id/save-progress', authenticateToken, examRoomController.saveProgress);
router.post('/:id/submit', authenticateToken, examRoomController.submitTest);

module.exports = router;