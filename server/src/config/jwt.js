const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required. Please set it in the server environment.');
}

module.exports = {
  JWT_SECRET,
  JWT_ACCESS_EXPIRES_IN,
  REFRESH_TOKEN_TTL_DAYS,
};
