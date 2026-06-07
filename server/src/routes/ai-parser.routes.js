const express = require("express");
const multer = require("multer");
const aiController = require("../controllers/ai-parser.controller");
const { authenticateToken } = require("../middleware/auth.middleware");
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });
router.post('/', authenticateToken, upload.single('file'), aiController.parseDocumentController);

module.exports = router;