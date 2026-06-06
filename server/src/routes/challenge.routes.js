const express = require("express");
const router = express.Router();
const { getSATQuestion, evaluateSATResponse } = require("../controllers/challenge.controller");

router.post("/generate", getSATQuestion);
router.post("/evaluate", evaluateSATResponse);

module.exports = router;