const express = require("express");
const router = express.Router();
const { getSATQuestion, evaluateSATResponse } = require("../controllers/challenge.controller");
const { authenticateToken } = require("../middleware/auth.middleware");

router.post("/generate", authenticateToken, getSATQuestion);
router.post("/evaluate", authenticateToken, evaluateSATResponse);

module.exports = router;