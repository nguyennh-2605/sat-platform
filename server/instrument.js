require('dotenv').config();
const Sentry = require('@sentry/node');

const dsn = process.env.SENTRY_DSN?.trim();
const configuredTraceRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0);
const tracesSampleRate = Number.isFinite(configuredTraceRate)
  ? Math.min(1, Math.max(0, configuredTraceRate))
  : 0;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || process.env.RENDER_GIT_COMMIT,
    sendDefaultPii: false,
    tracesSampleRate,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        if (event.request.headers) {
          for (const header of Object.keys(event.request.headers)) {
            if (/^(authorization|cookie)$/i.test(header)) delete event.request.headers[header];
          }
        }
      }
      return event;
    },
  });
}

module.exports = { Sentry, sentryEnabled: Boolean(dsn) };
