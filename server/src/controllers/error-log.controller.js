const ApiError = require('../utils/ApiError');
const errorLogService = require('../services/error-log.service');
const DEPRECATED_FIELDS = ['markReviewed', 'whyChosen', 'takeaway', 'rootCause'];

const exposeDeprecation = (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const used = DEPRECATED_FIELDS.filter(field => Object.prototype.hasOwnProperty.call(body, field));
  if (req.query?.rootCause !== undefined && !used.includes('rootCause')) used.push('rootCause');
  if (used.length === 0) return;
  res.set('Deprecation', 'true');
  res.set('Warning', `299 - "Ignored deprecated Error Log fields: ${used.join(', ')}"`);
};

const getRequestId = req => {
  const requestId = req.requestId || req.id || req.get?.('x-request-id');
  return typeof requestId === 'string' && requestId ? requestId.slice(0, 128) : undefined;
};

const handleError = ({ error, req, res, fallbackMessage }) => {
  const isApiError = error instanceof ApiError;
  const status = isApiError ? error.statusCode : 500;
  const logEntry = {
    event: 'error_log_request_failed',
    requestId: getRequestId(req),
    method: req.method,
    path: req.originalUrl?.split('?')[0] || req.path,
    status,
    errorName: error?.name || 'Error',
    prismaCode: typeof error?.code === 'string' ? error.code : undefined,
    durationMs: typeof req.requestStartedAt === 'bigint'
      ? Number(process.hrtime.bigint() - req.requestStartedAt) / 1e6
      : undefined,
  };

  console.error(JSON.stringify(logEntry));
  if (isApiError) return res.status(status).json(error.body);
  return res.status(status).json({ message: fallbackMessage });
};

exports.getErrorLogQuestion = async (req, res) => {
  try {
    res.json(await errorLogService.getErrorLogQuestion({ id: req.params.id, userId: req.user.userId }));
  } catch (error) {
    return handleError({ error, req, res, fallbackMessage: 'Unable to load the question.' });
  }
};

exports.getErrorLogs = async (req, res) => {
  try {
    exposeDeprecation(req, res);
    const logs = await errorLogService.getErrorLogs({ userId: req.user.userId, query: req.query });
    res.json(logs);
  } catch (error) {
    return handleError({ error, req, res, fallbackMessage: 'Unable to load the error log.' });
  }
};

exports.createErrorLog = async (req, res) => {
  try {
    exposeDeprecation(req, res);
    const newLog = await errorLogService.createErrorLog({
      userId: req.user.userId,
      data: req.body,
    });

    res.status(201).json(newLog);
  } catch (error) {
    return handleError({ error, req, res, fallbackMessage: 'Unable to create the error log entry.' });
  }
};

exports.updateErrorLog = async (req, res) => {
  try {
    exposeDeprecation(req, res);
    const updatedLog = await errorLogService.updateErrorLog({
      id: req.params.id,
      userId: req.user.userId,
      data: req.body,
    });
    res.json(updatedLog);
  } catch (error) {
    return handleError({ error, req, res, fallbackMessage: 'Unable to update the error log entry.' });
  }
};

exports.deleteErrorLog = async (req, res) => {
  try {
    await errorLogService.deleteErrorLog({ id: req.params.id, userId: req.user.userId });
    res.json({ message: 'Error log entry deleted.' });
  } catch (error) {
    return handleError({ error, req, res, fallbackMessage: 'Unable to delete the error log entry.' });
  }
};
