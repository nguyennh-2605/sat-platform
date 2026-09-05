require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { corsOptions } = require('./config/cors');
const apiRoutes = require('./routes');
const { authenticateToken } = require('./middleware/auth.middleware');
const { createRateLimiter } = require('./middleware/rate-limit.middleware');

// Login controllers (kept at root level since not part of REST API)
const { register, login, googleLogin, upgrade, refresh, logout } = require('./controllers/auth.controller');

const app = express();
const loginRateLimit = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: 'Too many sign-in attempts. Please try again shortly.',
});
const registrationRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many registration attempts. Please try again later.',
});
const googleLoginRateLimit = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 100,
  message: 'Too many Google sign-in attempts. Please try again shortly.',
});
const refreshRateLimit = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 120,
  message: 'Too many session refresh attempts. Please sign in again shortly.',
});
const accountUpgradeRateLimit = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: 'Too many account upgrade attempts. Please try again shortly.',
});

const configuredProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS, 10);
if (Number.isInteger(configuredProxyHops) && configuredProxyHops >= 0) {
  app.set('trust proxy', configuredProxyHops);
} else if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// --- MIDDLEWARE ---
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

// --- AUTH ROUTES (Direct authentication endpoints) ---
app.post('/api/register', registrationRateLimit, register);
app.post('/api/login', loginRateLimit, login);
app.post('/api/auth/google-login', googleLoginRateLimit, googleLogin);
app.post('/api/auth/upgrade', accountUpgradeRateLimit, authenticateToken, upgrade);
app.post('/api/auth/refresh', refreshRateLimit, refresh);
app.post('/api/auth/logout', logout);

// --- API ROUTES (RESTful routes) ---
app.use('/api', apiRoutes);

module.exports = app;
