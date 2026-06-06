const express = require('express');
const router = express.Router();
const testBankController = require('../controllers/test-bank.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.post('/folders', authenticateToken, testBankController.createFolder);
router.get('/folders/all', authenticateToken, testBankController.getAllFolders);
router.get('/', authenticateToken, testBankController.getFolderContent);
router.get('/:folderId', authenticateToken, testBankController.getFolderContent);
router.delete('/delete', authenticateToken, testBankController.deleteItems);
router.put('/move', authenticateToken, testBankController.moveItems);

module.exports = router;