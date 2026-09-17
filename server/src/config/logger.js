const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: {
    service: 'sat-platform-api',
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || process.env.RENDER_GIT_COMMIT || undefined,
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers.set-cookie',
      '*.password',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.googleToken',
    ],
    censor: '[REDACTED]',
  },
});

module.exports = logger;
