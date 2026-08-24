const { REFRESH_TOKEN_TTL_DAYS } = require('../config/jwt');

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/auth';
const isProduction = process.env.NODE_ENV === 'production';

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: REFRESH_COOKIE_PATH,
  maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
};

const readCookie = (req, name) => {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
};

const getRefreshCookie = req => readCookie(req, REFRESH_COOKIE_NAME);
const setRefreshCookie = (res, token) => res.cookie(REFRESH_COOKIE_NAME, token, cookieOptions);
const clearRefreshCookie = res => res.clearCookie(REFRESH_COOKIE_NAME, {
  httpOnly: true,
  secure: cookieOptions.secure,
  sameSite: cookieOptions.sameSite,
  path: REFRESH_COOKIE_PATH,
});

module.exports = {
  REFRESH_COOKIE_NAME,
  clearRefreshCookie,
  getRefreshCookie,
  setRefreshCookie,
};
