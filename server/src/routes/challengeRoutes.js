const express = require("express");
const router = express.Router();
const { getRandomPassage, verifyRecall } = require("../controllers/challengeController");

router.get("/random", getRandomPassage);
router.post("/verify", verifyRecall);

module.exports = router;