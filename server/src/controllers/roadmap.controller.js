const ApiError = require('../utils/ApiError');
const roadmapService = require('../services/roadmap.service');

const handle = (res, error, fallback) => {
  if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
  console.error(fallback, error);
  return res.status(500).json({ error: fallback });
};

exports.list = async (req, res) => {
  try {
    return res.json(await roadmapService.listAdminRoadmaps());
  } catch (error) { return handle(res, error, 'Unable to load the roadmap.'); }
};

exports.create = async (req, res) => {
  try { return res.status(201).json(await roadmapService.createRoadmap({ userId: req.user.userId, payload: req.body })); }
  catch (error) { return handle(res, error, 'Unable to create the roadmap.'); }
};

exports.update = async (req, res) => {
  try { return res.json(await roadmapService.updateRoadmap({ roadmapId: req.params.id, payload: req.body })); }
  catch (error) { return handle(res, error, 'Unable to update the roadmap.'); }
};

exports.createMilestone = async (req, res) => {
  try { return res.status(201).json(await roadmapService.createMilestone({ roadmapId: req.params.id, payload: req.body })); }
  catch (error) { return handle(res, error, 'Unable to create the milestone.'); }
};

exports.updateMilestone = async (req, res) => {
  try { return res.json(await roadmapService.updateMilestone({ roadmapId: req.params.id, milestoneId: req.params.milestoneId, payload: req.body })); }
  catch (error) { return handle(res, error, 'Unable to update the milestone.'); }
};

exports.publish = async (req, res) => {
  try { return res.json(await roadmapService.publishRoadmap({ roadmapId: req.params.id })); }
  catch (error) { return handle(res, error, 'Unable to publish the roadmap.'); }
};

exports.getMilestoneQuestions = async (req, res) => {
  try { return res.json(await roadmapService.getMilestoneQuestions({ milestoneId: req.params.milestoneId, userId: req.user.userId, query: req.query })); }
  catch (error) { return handle(res, error, 'Unable to load milestone practice.'); }
};

exports.confirmTheory = async (req, res) => {
  try { return res.json(await roadmapService.confirmTheory({ milestoneId: req.params.milestoneId, userId: req.user.userId })); }
  catch (error) { return handle(res, error, 'Unable to confirm this theory section.'); }
};

exports.answerQuestion = async (req, res) => {
  try {
    return res.json(await roadmapService.answerQuestion({
      milestoneId: req.params.milestoneId,
      questionId: req.params.questionId,
      selectedChoice: req.body.selectedChoice,
      userId: req.user.userId,
    }));
  } catch (error) { return handle(res, error, 'Unable to save this practice answer.'); }
};
