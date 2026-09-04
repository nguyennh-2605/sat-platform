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
const googleLoginRateLimit = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 100,
  message: 'Too many Google sign-in attempts. Please try again shortly.',
});

// --- MIDDLEWARE ---
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

// --- AUTH ROUTES (Direct authentication endpoints) ---
app.post('/api/register', register);
app.post('/api/login', login);
app.post('/api/auth/google-login', googleLoginRateLimit, googleLogin);
app.post('/api/auth/upgrade', authenticateToken, upgrade);
app.post('/api/auth/refresh', refresh);
app.post('/api/auth/logout', logout);

// --- API ROUTES (RESTful routes) ---
app.use('/api', apiRoutes);

module.exports = app;
