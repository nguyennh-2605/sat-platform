const ApiError = require('../utils/ApiError');
const progressService = require('../services/progress.service');

const getUserId = (req) => req.user?.userId || req.user?.id;
const getUserRole = (req) => req.user?.role;

// ==========================================
// WEEK MANAGEMENT
// ==========================================

exports.getWeeks = async (req, res) => {
  try {
    const weeks = await progressService.getWeeks({ classId: req.params.classId, userId: getUserId(req), userRole: getUserRole(req) });
    res.json({ success: true, data: weeks });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Get Weeks Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi lấy danh sách tuần học' });
  }
};

exports.createWeek = async (req, res) => {
  try {
    const newWeek = await progressService.createWeek({
      classId: req.params.classId,
      title: req.body.title,
      description: req.body.description,
      status: req.body.status,
      availableAt: req.body.availableAt,
      userId: getUserId(req),
      userRole: getUserRole(req),
    });
    res.status(201).json({ success: true, data: newWeek });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Create Week Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi tạo tuần học' });
  }
};

exports.updateWeek = async (req, res) => {
  try {
    const updatedWeek = await progressService.updateWeek({
      weekId: req.params.weekId,
      title: req.body.title,
      description: req.body.description,
      status: req.body.status,
      availableAt: req.body.availableAt,
      userId: getUserId(req),
      userRole: getUserRole(req),
    });
    res.json({ success: true, data: updatedWeek });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Update Week Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi cập nhật tuần học' });
  }
};

exports.deleteWeek = async (req, res) => {
  try {
    await progressService.deleteWeek({ weekId: req.params.weekId, userId: getUserId(req), userRole: getUserRole(req) });
    res.json({ success: true, message: 'Đã xóa tuần học' });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Delete Week Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi xóa tuần học' });
  }
};

// ==========================================
// LESSON MANAGEMENT
// ==========================================

exports.createLesson = async (req, res) => {
  try {
    const newLesson = await progressService.createLesson({
      weekId: req.params.weekId,
      title: req.body.title,
      summary: req.body.summary,
      status: req.body.status,
      scheduledAt: req.body.scheduledAt,
      durationMinutes: req.body.durationMinutes,
      availableAt: req.body.availableAt,
      userId: getUserId(req),
      userRole: getUserRole(req),
    });
    res.status(201).json({ success: true, data: newLesson });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Create Lesson Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi tạo buổi học' });
  }
};

exports.getOutline = async (req, res) => {
  try {
    const outline = await progressService.getOutline({ classId: req.params.classId, userId: getUserId(req), userRole: getUserRole(req) });
    res.json({ success: true, data: outline });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Get Course Outline Error:', error);
    res.status(500).json({ success: false, error: 'Unable to load the course outline.' });
  }
};

exports.reorderWeeks = async (req, res) => {
  try {
    const result = await progressService.reorderWeeks({
      classId: req.params.classId,
      orderedIds: req.body.orderedIds,
      userId: getUserId(req),
      userRole: getUserRole(req),
    });
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Reorder Weeks Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi sắp xếp tuần học' });
  }
};

exports.updateLesson = async (req, res) => {
  try {
    const lesson = await progressService.updateLesson({
      lessonId: req.params.lessonId,
      title: req.body.title,
      summary: req.body.summary,
      status: req.body.status,
      scheduledAt: req.body.scheduledAt,
      durationMinutes: req.body.durationMinutes,
      availableAt: req.body.availableAt,
      userId: getUserId(req),
      userRole: getUserRole(req),
    });
    res.json({ success: true, data: lesson });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Update Lesson Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi cập nhật buổi học' });
  }
};

exports.reorderLessons = async (req, res) => {
  try {
    const result = await progressService.reorderLessons({
      weekId: req.params.weekId,
      orderedIds: req.body.orderedIds,
      userId: getUserId(req),
      userRole: getUserRole(req),
    });
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Reorder Lessons Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi sắp xếp buổi học' });
  }
};

exports.deleteLesson = async (req, res) => {
  try {
    await progressService.deleteLesson({ lessonId: req.params.lessonId, userId: getUserId(req), userRole: getUserRole(req) });
    res.json({ success: true, message: 'Đã xóa buổi học' });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Delete Lesson Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi xóa buổi học' });
  }
};

// ==========================================
// FILE MANAGEMENT
// ==========================================

exports.addFiles = async (req, res) => {
  try {
    const newFiles = await progressService.addFiles({
      lessonId: req.params.lessonId,
      files: req.body.files,
      userId: getUserId(req),
      userRole: getUserRole(req),
    });
    res.status(201).json({ success: true, data: newFiles });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Add Files Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi thêm tài liệu' });
  }
};

exports.deleteFile = async (req, res) => {
  try {
    await progressService.deleteFile({ fileId: req.params.fileId, userId: getUserId(req), userRole: getUserRole(req) });
    res.json({ success: true, message: 'Đã xóa tài liệu' });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Delete File Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi xóa tài liệu' });
  }
};

exports.openResource = async (req, res) => {
  try {
    const progress = await progressService.openResource({ fileId: req.params.fileId, completed: req.body.completed, positionSeconds: req.body.positionSeconds, userId: getUserId(req), userRole: getUserRole(req) });
    res.json({ success: true, data: progress });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Open Resource Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi cập nhật tiến độ tài liệu' });
  }
};

exports.completeLesson = async (req, res) => {
  try {
    const progress = await progressService.completeLesson({ lessonId: req.params.lessonId, completed: req.body.completed !== false, userId: getUserId(req), userRole: getUserRole(req) });
    res.json({ success: true, data: progress });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Complete Lesson Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi cập nhật tiến độ buổi học' });
  }
};

// ==========================================
// ASSIGNMENT MANAGEMENT
// ==========================================

exports.createOrUpdateAssignment = async (req, res) => {
  try {
    const assignment = await progressService.createOrUpdateAssignment({
      lessonId: req.params.lessonId,
      title: req.body.title,
      content: req.body.content,
      dueDate: req.body.dueDate,
      testIds: req.body.testIds,
      userId: getUserId(req),
      userRole: getUserRole(req),
    });
    res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Create/Update Assignment Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi giao bài tập' });
  }
};

exports.deleteAssignment = async (req, res) => {
  try {
    await progressService.deleteAssignment({ assignmentId: req.params.assignmentId, userId: getUserId(req), userRole: getUserRole(req) });
    res.json({ success: true, message: 'Đã xóa bài tập' });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Delete Assignment Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi xóa bài tập' });
  }
};
