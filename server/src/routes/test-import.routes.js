const express = require('express');
const multer = require('multer');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');
const controller = require('../controllers/test-import.controller');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});

router.post('/preview', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), upload.single('file'), controller.previewFile);
router.post('/extract', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), upload.single('file'), controller.extractFile);
router.post('/preview-text', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), controller.previewText);

module.exports = router;
