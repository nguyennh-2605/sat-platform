const ApiError = require('../utils/ApiError');
const progressService = require('../services/progress.service');

const getUserId = (req) => req.user?.userId || req.user?.id;

// ==========================================
// WEEK MANAGEMENT
// ==========================================

exports.getWeeks = async (req, res) => {
  try {
    console.log('Getting weeks for classId:', req.params.classId);
    const weeks = await progressService.getWeeks({ classId: req.params.classId });
    console.log('Successfully fetched weeks:', weeks.length);
    res.json({ success: true, data: weeks });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Get Weeks Error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ success: false, error: 'Lỗi khi lấy danh sách tuần học' });
  }
};

exports.createWeek = async (req, res) => {
  try {
    const newWeek = await progressService.createWeek({
      classId: req.params.classId,
      title: req.body.title,
      userId: getUserId(req),
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
      isExpanded: req.body.isExpanded,
      userId: getUserId(req),
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
    await progressService.deleteWeek({ weekId: req.params.weekId, userId: getUserId(req) });
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
      userId: getUserId(req),
    });
    res.status(201).json({ success: true, data: newLesson });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Create Lesson Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi tạo buổi học' });
  }
};

exports.deleteLesson = async (req, res) => {
  try {
    await progressService.deleteLesson({ lessonId: req.params.lessonId, userId: getUserId(req) });
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
    await progressService.deleteFile({ fileId: req.params.fileId, userId: getUserId(req) });
    res.json({ success: true, message: 'Đã xóa tài liệu' });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Delete File Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi xóa tài liệu' });
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
    await progressService.deleteAssignment({ assignmentId: req.params.assignmentId, userId: getUserId(req) });
    res.json({ success: true, message: 'Đã xóa bài tập' });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Delete Assignment Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi xóa bài tập' });
  }
};
