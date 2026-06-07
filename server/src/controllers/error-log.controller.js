const ApiError = require('../utils/ApiError');
const errorLogService = require('../services/error-log.service');

// 1. Lấy danh sách Error Log của User đang đăng nhập
exports.getErrorLogs = async (req, res) => {
  try {
    const logs = await errorLogService.getErrorLogs({ userId: req.user.userId });
    res.json(logs);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error(error);
    res.status(500).json({ message: "Lỗi server khi lấy danh sách" });
  }
};

// 2. Tạo Error Log mới
exports.createErrorLog = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      console.log("Lỗi: Không tìm thấy user ID trong request");
      return res.status(401).json({ message: "Chưa xác thực user (Token lỗi hoặc Middleware chưa chạy)" });
    }

    const { source, category, userAnswer, correctAnswer, whyWrong, whyRight } = req.body;
    const newLog = await errorLogService.createErrorLog({
      userId: req.user.userId,
      source, category, userAnswer, correctAnswer, whyWrong, whyRight,
    });

    res.status(201).json(newLog);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error(error);
    res.status(500).json({ message: "Lỗi khi tạo log mới" });
  }
};

// 3. Cập nhật Error Log
exports.updateErrorLog = async (req, res) => {
  try {
    const updatedLog = await errorLogService.updateErrorLog({
      id: req.params.id,
      userId: req.user.userId,
      data: req.body,
    });
    res.json(updatedLog);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error(error);
    res.status(500).json({ message: "Lỗi khi cập nhật" });
  }
};

// 4. Xóa Error Log
exports.deleteErrorLog = async (req, res) => {
  try {
    await errorLogService.deleteErrorLog({ id: req.params.id, userId: req.user.userId });
    res.json({ message: "Đã xóa thành công" });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error(error);
    res.status(500).json({ message: "Lỗi khi xóa" });
  }
};
