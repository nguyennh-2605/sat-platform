const ApiError = require('../utils/ApiError');
const service = require('../services/class-announcement.service');

const respond = async (res, action, status = 200) => {
  try { return res.status(status).json(await action()); }
  catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Class announcement error:', error);
    return res.status(500).json({ error: 'Unable to process the class announcement.' });
  }
};
const identity = req => ({ userId: req.user?.userId || req.user?.id, userRole: req.user?.role });

exports.list = (req, res) => respond(res, () => service.list({ ...identity(req), classId: req.params.classId }));
exports.create = (req, res) => respond(res, () => service.create({ ...identity(req), classId: req.params.classId, data: req.body }), 201);
exports.update = (req, res) => respond(res, () => service.update({ ...identity(req), classId: req.params.classId, announcementId: req.params.announcementId, data: req.body }));
exports.remove = (req, res) => respond(res, () => service.remove({ ...identity(req), classId: req.params.classId, announcementId: req.params.announcementId }));
