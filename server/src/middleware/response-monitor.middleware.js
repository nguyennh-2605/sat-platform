const { Sentry, sentryEnabled } = require('../../instrument');

const monitorServerResponses = (req, res, next) => {
  res.once('finish', () => {
    if (!sentryEnabled || res.statusCode < 500 || res.locals.errorCaptured) return;
    Sentry.withScope(scope => {
      scope.setLevel('error');
      scope.setTag('request_id', req.requestId);
      scope.setTag('http.method', req.method);
      scope.setContext('http', {
        method: req.method,
        path: req.route?.path || req.path,
        statusCode: res.statusCode,
      });
      Sentry.captureMessage(`HTTP ${res.statusCode} response without a propagated exception`);
    });
  });
  next();
};

module.exports = { monitorServerResponses };
