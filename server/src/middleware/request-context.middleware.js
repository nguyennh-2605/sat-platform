const { randomUUID } = require('node:crypto');

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

const attachRequestContext = (req, res, next) => {
  const supplied = req.get('x-request-id');
  req.requestId = typeof supplied === 'string' && SAFE_REQUEST_ID.test(supplied)
    ? supplied
    : randomUUID();
  req.requestStartedAt = process.hrtime.bigint();
  res.set('x-request-id', req.requestId);
  next();
};

module.exports = { attachRequestContext };
