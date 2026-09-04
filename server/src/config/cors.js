const DEVELOPMENT_ORIGINS = ['http://localhost:5173', 'http://localhost:5174'];

const parseCorsOrigins = (value, nodeEnv = process.env.NODE_ENV) => {
  const origins = [...new Set(String(value || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean))];

  if (!origins.length) {
    if (nodeEnv !== 'production') return DEVELOPMENT_ORIGINS;
    throw new Error('CORS_ORIGINS is required when NODE_ENV=production.');
  }

  for (const origin of origins) {
    let parsed;
    try { parsed = new URL(origin); }
    catch { throw new Error(`CORS_ORIGINS contains an invalid origin: ${origin}`); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
      throw new Error(`CORS_ORIGINS must contain exact http(s) origins without paths: ${origin}`);
    }
    if (nodeEnv === 'production' && ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
      throw new Error(`CORS_ORIGINS cannot contain a loopback origin in production: ${origin}`);
    }
  }
  return origins;
};

const corsOptions = {
  origin: parseCorsOrigins(process.env.CORS_ORIGINS),
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Intent'],
  credentials: true,
};

module.exports = { corsOptions, parseCorsOrigins };
