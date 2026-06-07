const ApiError = require('../utils/ApiError');
const assignmentService = require('../services/assignment.service');

// XÓA BÀI TẬP
exports.deleteAssignment = async (req, res) => {
  try {
    await assignmentService.deleteAssignment({
      assignmentId: req.params.id,
      userId: req.user.userId || req.user.id,
    });
    return res.status(200).json({ success: true, message: "Xóa bài tập thành công!" });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error("Lỗi xóa bài tập:", error);
    return res.status(500).json({ message: "Lỗi server khi xóa bài tập" });
  }
};

// CẬP NHẬT BÀI TẬP
exports.updateAssignment = async (req, res) => {
  try {
    const updatedAssignment = await assignmentService.updateAssignment({
      assignmentId: req.params.id,
      userId: req.user.userId || req.user.id,
      title: req.body.title,
      content: req.body.content,
      fileUrls: req.body.fileUrls,
      links: req.body.links,
      deadline: req.body.deadline,
      testIds: req.body.testIds,
    });
    return res.status(200).json({
      success: true,
      message: "Cập nhật bài tập thành công!",
      data: updatedAssignment
    });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error("Lỗi cập nhật bài tập:", error);
    return res.status(500).json({ message: "Lỗi server khi cập nhật bài tập" });
  }
};

exports.getAssignmentById = async (req, res) => {
  try {
    const data = await assignmentService.getAssignmentById({ id: req.params.id });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.log("Lỗi khi lấy assignment", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};
