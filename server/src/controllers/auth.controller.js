const ApiError = require('../utils/ApiError');
const authService = require('../services/auth.service');
const { clearRefreshCookie, getRefreshCookie, setRefreshCookie } = require('../utils/auth-cookie');

const sendAuthResult = (res, status, result) => {
  const { refreshToken, ...body } = result;
  setRefreshCookie(res, refreshToken);
  return res.status(status).json(body);
};

const sendError = (res, error, fallbackMessage, fallbackStatus = 500) => {
  if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
  console.error(error);
  return res.status(fallbackStatus).json({ message: fallbackMessage });
};

const requireIntent = (req, res, expected) => {
  if (req.get('X-CSRF-Intent') === expected) return true;
  res.status(403).json({ code: 'AUTH_INTENT_REQUIRED', message: 'Authentication request intent is invalid.' });
  return false;
};

const register = async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    return sendAuthResult(res, 201, await authService.register({ email, password, name, role }));
  } catch (error) {
    return sendError(res, error, 'Lỗi Server');
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    return sendAuthResult(res, 200, await authService.login({ email, password }));
  } catch (error) {
    return sendError(res, error, 'Lỗi Server');
  }
};

const googleLogin = async (req, res) => {
  try {
    return sendAuthResult(res, 200, await authService.googleLogin({ token: req.body.token }));
  } catch (error) {
    return sendError(res, error, 'Google login failed', 400);
  }
};

const upgrade = async (req, res) => {
  if (!requireIntent(req, res, 'upgrade')) return;
  try {
    return sendAuthResult(res, 200, await authService.upgrade({ userId: req.user?.userId || req.user?.id }));
  } catch (error) {
    return sendError(res, error, 'Unable to upgrade session');
  }
};

const refresh = async (req, res) => {
  if (!requireIntent(req, res, 'refresh')) return;
  try {
    return sendAuthResult(res, 200, await authService.refresh({ refreshToken: getRefreshCookie(req) }));
  } catch (error) {
    if (!(error instanceof ApiError) || error.body?.code !== 'REFRESH_TOKEN_ROTATED') clearRefreshCookie(res);
    return sendError(res, error, 'Unable to refresh session');
  }
};

const logout = async (req, res) => {
  if (!requireIntent(req, res, 'logout')) return;
  try {
    await authService.logout({ refreshToken: getRefreshCookie(req) });
    clearRefreshCookie(res);
    return res.status(204).end();
  } catch (error) {
    clearRefreshCookie(res);
    return sendError(res, error, 'Unable to end session');
  }
};

module.exports = { register, login, googleLogin, upgrade, refresh, logout };
