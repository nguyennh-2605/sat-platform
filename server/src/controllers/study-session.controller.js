const ApiError = require('../utils/ApiError');
const studySessionService = require('../services/study-session.service');

const handleError = (res, error) => {
  if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
  console.error('Unable to update focus session.', error);
  return res.status(500).json({ message: 'Unable to update focus session.' });
};

const userIdFor = (req) => Number(req.user?.userId || req.user?.id);

exports.getActive = async (req, res) => {
  try { res.json(await studySessionService.getActive({ userId: userIdFor(req) })); }
  catch (error) { handleError(res, error); }
};

exports.getSummary = async (req, res) => {
  try { res.json(await studySessionService.getSummary({ userId: userIdFor(req), query: req.query })); }
  catch (error) { handleError(res, error); }
};

exports.start = async (req, res) => {
  try { res.status(201).json(await studySessionService.start({ userId: userIdFor(req), body: req.body })); }
  catch (error) { handleError(res, error); }
};

const transition = (action) => async (req, res) => {
  try {
    res.json(await studySessionService[action]({
      userId: userIdFor(req),
      id: req.params.id,
      expectedVersion: req.body?.expectedVersion,
    }));
  } catch (error) { handleError(res, error); }
};

exports.pause = transition('pause');
exports.resume = transition('resume');
exports.finish = transition('finish');
exports.cancel = transition('cancel');
