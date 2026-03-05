const express = require("express");
const multer = require("multer");
const aiController = require("../controllers/aiParserController");
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });
router.post('/', upload.single('file'), aiController.parseDocumentController);

module.exports = router;