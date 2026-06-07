const ApiError = require('../utils/ApiError');
const classService = require('../services/class.service');

exports.createClass = async (req, res) => {
  try {
    const newClass = await classService.createClass({
      name: req.body.name,
      userId: req.user?.userId || req.user?.id,
      userRole: req.user?.role || req.user?.userRole,
    });
    res.status(201).json(newClass);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error("Create Class Error:", error);
    res.status(500).json({ error: "Lỗi server khi tạo lớp học" });
  }
};

exports.getMyClasses = async (req, res) => {
  try {
    const classes = await classService.getMyClasses({
      userId: req.user?.id || req.user?.userId,
      userRole: req.user?.role,
    });
    res.json(classes);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error("Get Classes Error:", error);
    res.status(500).json({ error: "Lỗi lấy danh sách lớp" });
  }
};

exports.getClassDetail = async (req, res) => {
  try {
    const classDetail = await classService.getClassDetail({
      id: req.params.id,
      userId: req.user?.id || req.user?.userId,
      userRole: req.user?.role,
    });
    res.json(classDetail);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error("Get Class Detail Error:", error);
    res.status(500).json({ error: "Lỗi lấy thông tin lớp" });
  }
};

exports.addStudentToClass = async (req, res) => {
  try {
    const result = await classService.addStudentToClass({
      classId: req.params.classId,
      email: req.body.email,
      currentUserId: req.user?.id || req.user?.userId,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error("Add Student Error:", error);
    res.status(500).json({ error: "Lỗi khi thêm học sinh" });
  }
};

exports.createAssignment = async (req, res) => {
  try {
    const newAssignment = await classService.createAssignment({
      ...req.body,
      currentUserId: req.user?.id || req.user?.userId,
      userRole: req.user?.role,
    });
    res.json(newAssignment);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error(error);
    res.status(500).json({ error: "Lỗi tạo bài tập" });
  }
};

exports.createSubmission = async (req, res) => {
  try {
    const submission = await classService.createSubmission({
      assignmentId: req.body.assignmentId,
      textResponse: req.body.textResponse,
      fileUrl: req.body.fileUrl,
      studentId: req.user?.id || req.user?.userId,
    });
    res.status(201).json({ message: "Nộp bài thành công!", data: submission });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error("❌ Lỗi nộp bài:", error);
    res.status(500).json({ error: "Lỗi server khi nộp bài" });
  }
};

exports.getExamTests = async (req, res) => {
  try {
    const tests = await classService.getExamTests({
      classId: req.query.classId,
      userId: req.user?.id || req.user?.userId,
      userRole: req.user?.role,
    });
    res.json(tests);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error("Lỗi lấy danh sách bài thi:", error);
    res.status(500).json({ error: "Lỗi server khi lấy danh sách" });
  }
};

exports.getScoreReportAssignments = async (req, res) => {
  try {
    const assignments = await classService.getScoreReportAssignments({
      classId: req.params.id,
      userId: req.user?.id || req.user?.userId,
      userRole: req.user?.role,
    });
    return res.status(200).json({
      success: true,
      message: "Lấy dữ liệu score report thành công",
      data: assignments
    });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error("Lỗi lấy score report theo assignment:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy score report",
      data: null
    });
  }
};

exports.getTestAnalytics = async (req, res) => {
  try {
    const result = await classService.getTestAnalytics({
      testId: req.params.testId,
      assignmentId: req.query.assignmentId ? String(req.query.assignmentId) : null,
      userId: req.user?.id || req.user?.userId,
      userRole: req.user?.role,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error("Lỗi Test Analytics:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
};
