const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiChatBotController');
const { authenticateToken } = require('../middleware/authMiddleware'); 

router.post('/chat', authenticateToken, aiController.chatExplain);

module.exports = router;