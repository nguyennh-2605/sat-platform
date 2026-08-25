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
    const result = await practiceTestService.getTests({
      userId: req.user.userId,
      userRole: req.user.role,
      query: req.query,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error("API Error:", error);
    res.status(500).json({ error: 'Lỗi lấy danh sách bài thi' });
  }
};

exports.assignTestsToClasses = async (req, res) => {
  try {
    const result = await practiceTestService.assignTestsToClasses({
      testIds: req.body.testIds,
      classIds: req.body.classIds,
      availableAt: req.body.availableAt,
      dueAt: req.body.dueAt,
      maxAttempts: req.body.maxAttempts,
      scorePolicy: req.body.scorePolicy,
      userId: req.user.userId,
      userRole: req.user.role,
    });
    res.json({ message: 'Giao đề thi cho lớp thành công', ...result });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Assign tests error:', error);
    res.status(500).json({ error: 'Lỗi giao đề thi cho lớp' });
  }
};

exports.getTaxonomy = async (req, res) => {
  try {
    const taxonomy = practiceTestService.getTaxonomy({ subject: req.query.subject });
    res.json(taxonomy);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Get taxonomy error:', error);
    res.status(500).json({ error: 'Unable to load the SAT content taxonomy.' });
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

exports.getTestForEdit = async (req, res) => {
  try {
    const test = await practiceTestService.getTestForEdit({
      testId: req.params.id,
      userId: req.user.userId,
    });
    res.json(test);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Get test for edit error:', error);
    res.status(500).json({ error: 'Unable to load this exam.' });
  }
};

exports.updateTest = async (req, res) => {
  try {
    const test = await practiceTestService.updateTest({
      ...req.body,
      testId: req.params.id,
      userId: req.user.userId,
      userRole: req.user.role,
    });
    res.json(test);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Update test error:', error);
    res.status(500).json({ error: 'Unable to update this exam.' });
  }
};

exports.deleteTest = async (req, res) => {
  try {
    await practiceTestService.deleteTest({ testId: req.params.id, userId: req.user.userId });
    res.status(204).send();
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Delete test error:', error);
    res.status(500).json({ error: 'Unable to delete this exam.' });
  }
};
