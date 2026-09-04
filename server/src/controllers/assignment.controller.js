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
      maxPoints: req.body.maxPoints,
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
    const data = await assignmentService.getAssignmentById({
      id: req.params.id,
      userId: req.user.userId || req.user.id,
      userRole: req.user.role,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.log("Lỗi khi lấy assignment", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

exports.listStudentWork = async (req, res) => {
  try {
    const data = await assignmentService.listStudentWork({
      assignmentId: req.params.id,
      userId: req.user.userId || req.user.id,
      userRole: req.user.role,
      search: req.query.search,
      status: req.query.status,
      cursor: req.query.cursor,
      limit: req.query.limit,
    });
    return res.json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('List assignment student work error:', error);
    return res.status(500).json({ error: 'Unable to load student work.' });
  }
};

exports.getStudentWork = async (req, res) => {
  try {
    const data = await assignmentService.getStudentWork({
      assignmentId: req.params.id,
      studentId: req.params.studentId,
      userId: req.user.userId || req.user.id,
      userRole: req.user.role,
    });
    return res.json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Get assignment student work error:', error);
    return res.status(500).json({ error: 'Unable to load the submission.' });
  }
};

exports.reviewStudentWork = async (req, res) => {
  try {
    const data = await assignmentService.reviewStudentWork({
      assignmentId: req.params.id,
      studentId: req.params.studentId,
      userId: req.user.userId || req.user.id,
      userRole: req.user.role,
      score: req.body.score,
      feedback: req.body.feedback,
    });
    return res.json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Review assignment student work error:', error);
    return res.status(500).json({ error: 'Unable to save the review.' });
  }
};

exports.upsertSubmission = async (req, res) => {
  try {
    const data = await assignmentService.upsertSubmission({
      assignmentId: req.params.id,
      textResponse: req.body.textResponse,
      fileUrl: req.body.fileUrl,
      studentId: req.user.userId || req.user.id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Submit assignment error:', error);
    return res.status(500).json({ error: 'Unable to submit the assignment.' });
  }
};

exports.getMySubmission = async (req, res) => {
  try {
    const data = await assignmentService.getMySubmission({ assignmentId: req.params.id, studentId: req.user.userId || req.user.id });
    return res.json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Load assignment draft error:', error);
    return res.status(500).json({ error: 'Unable to load your work.' });
  }
};

exports.updateDraft = async (req, res) => {
  try {
    const data = await assignmentService.updateDraft({ assignmentId: req.params.id, studentId: req.user.userId || req.user.id, textResponse: req.body.textResponse, expectedVersion: req.body.expectedVersion });
    return res.json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Save assignment draft error:', error);
    return res.status(500).json({ error: 'Unable to save your draft.' });
  }
};

exports.editSubmission = async (req, res) => {
  try {
    const data = await assignmentService.editSubmission({ assignmentId: req.params.id, studentId: req.user.userId || req.user.id });
    return res.json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Edit assignment submission error:', error);
    return res.status(500).json({ error: 'Unable to edit this submission.' });
  }
};

exports.discardDraft = async (req, res) => {
  try {
    const data = await assignmentService.discardDraft({ assignmentId: req.params.id, studentId: req.user.userId || req.user.id });
    return res.json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Discard assignment draft error:', error);
    return res.status(500).json({ error: 'Unable to discard this draft.' });
  }
};

exports.addDraftItem = async (req, res) => {
  try {
    const data = await assignmentService.addDraftItem({ assignmentId: req.params.id, studentId: req.user.userId || req.user.id, ...req.body });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Add assignment attachment error:', error);
    return res.status(500).json({ error: 'Unable to add this attachment.' });
  }
};

exports.removeDraftItem = async (req, res) => {
  try {
    const data = await assignmentService.removeDraftItem({ assignmentId: req.params.id, itemId: req.params.itemId, studentId: req.user.userId || req.user.id });
    return res.json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Remove assignment attachment error:', error);
    return res.status(500).json({ error: 'Unable to remove this attachment.' });
  }
};

exports.submitDraft = async (req, res) => {
  try {
    const data = await assignmentService.submitDraft({ assignmentId: req.params.id, studentId: req.user.userId || req.user.id });
    return res.json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Submit assignment draft error:', error);
    return res.status(500).json({ error: 'Unable to submit the assignment.' });
  }
};
