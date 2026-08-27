const ApiError = require('../utils/ApiError');
const studentOverviewService = require('../services/student-overview.service');
const studentTaskService = require('../services/student-task.service');

exports.getOverview = async (req, res) => {
  try {
    return res.json(await studentOverviewService.getOverview({ userId: req.user.userId || req.user.id }));
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Unable to load the student overview.', error);
    return res.status(500).json({ error: 'Unable to load your overview.' });
  }
};

const taskAction = async (req, res, action, successStatus = 200) => {
  try {
    return res.status(successStatus).json(await action());
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Unable to update student tasks.', error);
    return res.status(500).json({ error: 'Unable to update tasks.' });
  }
};

const userIdFor = req => req.user?.userId || req.user?.id;

exports.getTasks = (req, res) => taskAction(req, res, () => studentTaskService.getTasks({ userId: userIdFor(req), userRole: req.user.role }));
exports.createTask = (req, res) => taskAction(req, res, () => studentTaskService.createTask({ userId: userIdFor(req), userRole: req.user.role, data: req.body }), 201);
exports.updateTask = (req, res) => taskAction(req, res, () => studentTaskService.updateTask({ taskId: req.params.id, userId: userIdFor(req), userRole: req.user.role, data: req.body }));
exports.deleteTask = (req, res) => taskAction(req, res, () => studentTaskService.deleteTask({ taskId: req.params.id, userId: userIdFor(req), userRole: req.user.role }));
exports.updateTaskState = (req, res) => taskAction(req, res, () => studentTaskService.updateTaskState({ itemKey: req.body?.itemKey, completed: req.body?.completed, userId: userIdFor(req), userRole: req.user.role }));
exports.reorderTasks = (req, res) => taskAction(req, res, () => studentTaskService.reorderTasks({ orderedKeys: req.body?.orderedKeys, userId: userIdFor(req), userRole: req.user.role }));
