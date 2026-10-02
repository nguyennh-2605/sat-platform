const ApiError = require('../utils/ApiError');
const questionBankService = require('../services/question-bank.service');

const handle = (res, error, fallback) => {
  if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
  console.error(fallback, error);
  return res.status(500).json({ error: fallback });
};

exports.listQuestions = async (req, res) => {
  try {
    return res.json(await questionBankService.listQuestions({ userId: req.user.userId, userRole: req.user.role, query: req.query }));
  } catch (error) { return handle(res, error, 'Unable to load the question bank.'); }
};

exports.createQuestion = async (req, res) => {
  try {
    const item = await questionBankService.createQuestion({ userId: req.user.userId, userRole: req.user.role, payload: req.body });
    return res.status(201).json(item);
  } catch (error) { return handle(res, error, 'Unable to create this question.'); }
};

exports.updateQuestion = async (req, res) => {
  try {
    return res.json(await questionBankService.updateQuestion({ questionId: req.params.id, userId: req.user.userId, userRole: req.user.role, payload: req.body }));
  } catch (error) { return handle(res, error, 'Unable to update this question.'); }
};

exports.updateStatus = async (req, res) => {
  try {
    return res.json(await questionBankService.updateStatus({ questionId: req.params.id, userId: req.user.userId, userRole: req.user.role, status: req.body.status }));
  } catch (error) { return handle(res, error, 'Unable to update this question status.'); }
};

exports.createRandomQuiz = async (req, res) => {
  try {
    const quiz = await questionBankService.createRandomQuiz({ userId: req.user.userId, payload: req.body });
    return res.status(201).json(quiz);
  } catch (error) { return handle(res, error, 'Unable to create a random quiz.'); }
};

exports.createAssignedQuiz = async (req, res) => {
  try {
    const quiz = await questionBankService.createAssignedQuiz({ userId: req.user.userId, userRole: req.user.role, payload: req.body });
    return res.status(201).json(quiz);
  } catch (error) { return handle(res, error, 'Unable to create this quiz.'); }
};
