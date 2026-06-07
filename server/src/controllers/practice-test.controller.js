const ApiError = require('../utils/ApiError');
const practiceTestService = require('../services/practice-test.service');

exports.getClasses = async (req, res) => {
  try {
    const classes = await practiceTestService.getClasses({
      userId: req.user.userId,
      userRole: req.user.role,
    });
    res.json(classes);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error("Error get classes:", error);
    res.status(500).json({ error: "Lỗi lấy danh sách lớp" });
  }
};

// 2. API LẤY DANH SÁCH BÀI THI (Cho PracticeTest)
exports.getTests = async (req, res) => {
  try {
    const result = await practiceTestService.getTests({ userId: req.user.userId });
    res.json(result);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error("API Error:", error);
    res.status(500).json({ error: 'Lỗi lấy danh sách bài thi' });
  }
};

exports.createTest = async (req, res) => {
  try {
    const newTest = await practiceTestService.createTest({
      ...req.body,
      userId: req.user.userId,
      userRole: req.user.role,
    });
    res.status(200).json(newTest);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error("❌ Lỗi tạo đề thi:", error);
    res.status(500).json({ error: 'Lỗi server khi tạo đề thi', details: error.message });
  }
};
