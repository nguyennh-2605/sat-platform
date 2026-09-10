const ApiError = require('../utils/ApiError');
const errorLogService = require('../services/error-log.service');

exports.getErrorLogQuestion = async (req, res) => {
  try {
    res.json(await errorLogService.getErrorLogQuestion({ id: req.params.id, userId: req.user.userId }));
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error(error);
    res.status(500).json({ message: 'Unable to load the question.' });
  }
};

exports.getErrorLogs = async (req, res) => {
  try {
    const logs = await errorLogService.getErrorLogs({ userId: req.user.userId, query: req.query });
    res.json(logs);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error(error);
    res.status(500).json({ message: 'Unable to load the error log.' });
  }
};

exports.createErrorLog = async (req, res) => {
  try {
    const newLog = await errorLogService.createErrorLog({
      userId: req.user.userId,
      data: req.body,
    });

    res.status(201).json(newLog);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error(error);
    res.status(500).json({ message: 'Unable to create the error log entry.' });
  }
};

exports.updateErrorLog = async (req, res) => {
  try {
    const updatedLog = await errorLogService.updateErrorLog({
      id: req.params.id,
      userId: req.user.userId,
      data: req.body,
    });
    res.json(updatedLog);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error(error);
    res.status(500).json({ message: 'Unable to update the error log entry.' });
  }
};

exports.deleteErrorLog = async (req, res) => {
  try {
    await errorLogService.deleteErrorLog({ id: req.params.id, userId: req.user.userId });
    res.json({ message: 'Error log entry deleted.' });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error(error);
    res.status(500).json({ message: 'Unable to delete the error log entry.' });
  }
};
