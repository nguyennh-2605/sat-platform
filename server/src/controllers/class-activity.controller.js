const ApiError = require('../utils/ApiError');
const classActivityService = require('../services/class-activity.service');

exports.listForClass = async (req, res) => {
  try {
    const activities = await classActivityService.listClassActivities({
      classId: req.params.classId,
      userId: req.user.userId,
      userRole: req.user.role,
    });
    res.json(activities);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('List class activities error:', error);
    res.status(500).json({ error: 'Unable to load class activities.' });
  }
};

exports.createHomework = async (req, res) => {
  try {
    const activity = await classActivityService.createHomeworkActivity({
      ...req.body,
      userId: req.user.userId || req.user.id,
      userRole: req.user.role,
    });
    res.status(201).json(activity);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Create homework activity error:', error);
    res.status(500).json({ error: 'Unable to create the homework activity.' });
  }
};
