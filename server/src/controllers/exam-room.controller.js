const ApiError = require('../utils/ApiError');
const examRoomService = require('../services/exam-room.service');

// 3. API LẤY CHI TIẾT ĐỀ THI & CÂU HỎI (Cho ExamRoom)
exports.startOrResumeTest = async (req, res) => {
  try {
    const data = await examRoomService.startOrResumeTest({
      testId: parseInt(req.params.id),
      userId: req.user.userId,
      userRole: req.user.role,
      assignmentId: req.query.assignmentId ? String(req.query.assignmentId) : null,
      classId: req.query.classId ? String(req.query.classId) : null,
    });
    res.json(data);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error(error);
    res.status(500).json({ error: 'Lỗi tải đề thi' });
  }
};

exports.saveProgress = async (req, res) => {
  try {
    await examRoomService.saveProgress({
      userId: req.user.userId,
      submissionId: req.body.submissionId,
      answers: req.body.answers,
      timeLeft: req.body.timeLeft,
      currentQuestionIndex: req.body.currentQuestionIndex,
      violationCount: req.body.violationCount,
    });
    res.json({ success: true, message: "Đã lưu tiến độ thành công!" });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error(error);
    res.status(500).json({ message: "Lỗi lưu bài" });
  }
};

exports.beginTest = async (req, res) => {
  try {
    const result = await examRoomService.beginTest({
      userId: req.user.userId,
      submissionId: req.body.submissionId,
      testId: parseInt(req.params.id)
    });
    res.json(result);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error(error);
    res.status(500).json({ error: 'Lỗi bắt đầu bài thi' });
  }
};

exports.submitTest = async (req, res) => {
  try {
    const result = await examRoomService.submitTest({
      userId: req.user.userId,
      submissionId: req.body.submissionId,
      answers: req.body.answers,
      violationCount: req.body.violationCount,
      testId: parseInt(req.params.id),
      assignmentId: req.query.assignmentId ? String(req.query.assignmentId) : null,
      classId: req.query.classId ? String(req.query.classId) : null,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error("❌ LỖI SERVER:", error);
    res.status(500).json({ error: "Lỗi server: " + error.message });
  }
};
