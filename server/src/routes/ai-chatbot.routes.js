const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai-chatbot.controller');
const { authenticateToken } = require('../middleware/auth.middleware'); 

router.post('/chat', authenticateToken, aiController.chatExplain);

module.exports = router;