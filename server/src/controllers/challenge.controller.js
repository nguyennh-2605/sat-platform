const challengeService = require('../services/challenge.service');

// 1. Tạo câu hỏi SAT
exports.getSATQuestion = async (req, res) => {
  try {
    const { difficulty = "Medium", type = "Command of Evidence" } = req.body;
    const result = await challengeService.getSATQuestion({ difficulty, type });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Lỗi tạo đề", details: error.message });
  }
};

exports.evaluateSATResponse = async (req, res) => {
  try {
    const { questionData, userChoice, userExplanations } = req.body;
    const result = await challengeService.evaluateSATResponse({ questionData, userChoice, userExplanations });
    res.json(result);
  } catch (error) {
    console.error("🔥 Error evaluating:", error);
    res.status(500).json({ error: "Lỗi chấm bài", details: error.message });
  }
};
