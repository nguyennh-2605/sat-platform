const prisma = require('../config/prisma');

const createHealthHandlers = ({ database = prisma } = {}) => ({
  liveness(req, res) {
    return res.status(200).json({ status: 'ok', requestId: req.requestId });
  },

  async readiness(req, res) {
    try {
      await database.$queryRawUnsafe('SELECT 1');
      return res.status(200).json({ status: 'ready', requestId: req.requestId });
    } catch (error) {
      req.log?.error({
        requestId: req.requestId,
        errorName: error?.name,
        errorCode: error?.code,
      }, 'Readiness check failed');
      return res.status(503).json({ status: 'unavailable', requestId: req.requestId });
    }
  },
});

module.exports = { createHealthHandlers };
