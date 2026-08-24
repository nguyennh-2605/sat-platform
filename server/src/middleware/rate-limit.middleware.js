const createRateLimiter = ({ windowMs, max, message }) => {
  const requests = new Map();
  let nextCleanupAt = Date.now() + windowMs;

  return (req, res, next) => {
    const now = Date.now();
    if (now >= nextCleanupAt) {
      for (const [requestKey, value] of requests) {
        if (value.resetAt <= now) requests.delete(requestKey);
      }
      nextCleanupAt = now + windowMs;
    }
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const current = requests.get(key);

    if (!current || current.resetAt <= now) {
      requests.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count <= max) return next();

    res.set('Retry-After', String(Math.max(1, Math.ceil((current.resetAt - now) / 1000))));
    return res.status(429).json({ code: 'RATE_LIMITED', message });
  };
};

module.exports = { createRateLimiter };
