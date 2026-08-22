const ApiError = require('../utils/ApiError');
const todoService = require('../services/class-todo.service');

const handleError = (res, error, fallback) => {
  if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
  console.error(fallback, error);
  return res.status(500).json({ error: fallback });
};

exports.list = async (req, res) => {
  try {
    const items = await todoService.getTodos({
      userId: req.user?.userId || req.user?.id,
      userRole: req.user?.role || req.user?.userRole,
    });
    res.json({ items });
  } catch (error) {
    handleError(res, error, 'Unable to load To Do items.');
  }
};

exports.acknowledge = async (req, res) => {
  try {
    const result = await todoService.acknowledgeTodo({
      itemKey: req.body?.itemKey,
      userId: req.user?.userId || req.user?.id,
      userRole: req.user?.role || req.user?.userRole,
    });
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Unable to update the To Do item.');
  }
};
