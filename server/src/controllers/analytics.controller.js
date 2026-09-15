const ApiError = require('../utils/ApiError');
const analyticsService = require('../services/analytics.service');

exports.getData = async (req, res) => {
  try {
    const result = await analyticsService.getData({
      userId: req.user.userId,
      range: req.query.range,
      days: req.query.days,
      subject: req.query.subject,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error("Lỗi Analytics:", error);
    res.status(500).json({ message: "Lỗi server khi lấy thống kê" });
  }
};

exports.getAttempts = async (req, res) => {
  try {
    const result = await analyticsService.getAttempts({
      userId: req.user.userId,
      query: req.query,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Unable to load analytics attempts:', error);
    res.status(500).json({ message: 'Unable to load attempts.' });
  }
};

exports.getSubmissionDetail = async (req, res) => {
  try {
    const responseData = await analyticsService.getSubmissionDetail({
      id: req.params.id,
      userId: req.user.userId,
    });
    res.json(responseData);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error("Lỗi lấy chi tiết bài thi:", error);
    res.status(500).json({ message: "Lỗi server khi tải chi tiết bài thi." });
  }
};
