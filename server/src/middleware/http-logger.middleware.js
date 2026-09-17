const pino = require('pino');
const pinoHttp = require('pino-http');
const logger = require('../config/logger');

const httpLogger = pinoHttp({
  logger,
  genReqId: req => req.requestId,
  customAttributeKeys: { responseTime: 'durationMs' },
  customLogLevel(_req, res, error) {
    if (error || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: req => `${req.method} completed`,
  customErrorMessage: req => `${req.method} failed`,
  autoLogging: {
    ignore: req => req.url === '/health' || req.url === '/ready',
  },
  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
        remoteAddress: req.remoteAddress,
      };
    },
    res(res) {
      return { statusCode: res.statusCode };
    },
    err: pino.stdSerializers.err,
  },
});

module.exports = { httpLogger };
