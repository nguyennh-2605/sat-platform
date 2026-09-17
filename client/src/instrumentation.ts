import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
const configuredTraceRate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0);
const tracesSampleRate = Number.isFinite(configuredTraceRate)
  ? Math.min(1, Math.max(0, configuredTraceRate))
  : 0;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
  release: import.meta.env.VITE_SENTRY_RELEASE,
  sendDefaultPii: false,
  integrations: tracesSampleRate > 0 ? [Sentry.browserTracingIntegration()] : [],
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
