const ApiError = require('../utils/ApiError');
const analyticsService = require('../services/analytics.service');

exports.getData = async (req, res) => {
  try {
    const result = await analyticsService.getData({
      userId: req.user.userId,
      days: req.query.days,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error("Lỗi Analytics:", error);
    res.status(500).json({ message: "Lỗi server khi lấy thống kê" });
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
