const DEFAULT_MAX_KEYS = 10_000;

const createRateLimiter = ({ windowMs, max, message, key, maxKeys = DEFAULT_MAX_KEYS, clock = Date.now }) => {
  if (!Number.isFinite(windowMs) || windowMs <= 0) throw new TypeError('windowMs must be a positive number.');
  if (!Number.isInteger(max) || max <= 0) throw new TypeError('max must be a positive integer.');
  if (!Number.isInteger(maxKeys) || maxKeys <= 0) throw new TypeError('maxKeys must be a positive integer.');

  const requests = new Map();
  let nextCleanupAt = clock() + windowMs;

  const setHeaders = (res, remaining, resetAt, now) => {
    res.set('RateLimit-Limit', String(max));
    res.set('RateLimit-Remaining', String(Math.max(0, remaining)));
    res.set('RateLimit-Reset', String(Math.max(1, Math.ceil((resetAt - now) / 1000))));
  };

  return (req, res, next) => {
    const now = clock();
    if (now >= nextCleanupAt) {
      for (const [requestKey, value] of requests) {
        if (value.resetAt <= now) requests.delete(requestKey);
      }
      nextCleanupAt = now + windowMs;
    }
    const requestKey = key?.(req) || req.ip || req.socket?.remoteAddress || 'unknown';
    const current = requests.get(requestKey);

    if (!current || current.resetAt <= now) {
      if (!current && requests.size >= maxKeys) requests.delete(requests.keys().next().value);
      const resetAt = now + windowMs;
      requests.set(requestKey, { count: 1, resetAt });
      setHeaders(res, max - 1, resetAt, now);
      return next();
    }

    current.count += 1;
    setHeaders(res, max - current.count, current.resetAt, now);
    if (current.count <= max) return next();

    res.set('Retry-After', String(Math.max(1, Math.ceil((current.resetAt - now) / 1000))));
    return res.status(429).json({ code: 'RATE_LIMITED', message });
  };
};

module.exports = { createRateLimiter, DEFAULT_MAX_KEYS };
