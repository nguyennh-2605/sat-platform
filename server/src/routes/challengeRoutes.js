const express = require("express");
const router = express.Router();
const { getSATQuestion, evaluateSATResponse } = require("../controllers/challengeController");

router.post("/generate", getSATQuestion);
router.post("/evaluate", evaluateSATResponse);

module.exports = router;