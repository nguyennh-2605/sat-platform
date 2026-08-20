require('dotenv').config();
const express = require('express');
const cors = require('cors');
const corsOptions = require('./config/cors');
const apiRoutes = require('./routes');

// Login controllers (kept at root level since not part of REST API)
const { register, login, googleLogin } = require('./controllers/auth.controller');

const app = express();

// --- MIDDLEWARE ---
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

// --- AUTH ROUTES (Direct authentication endpoints) ---
app.post('/api/register', register);
app.post('/api/login', login);
app.post('/api/auth/google-login', googleLogin);

// --- API ROUTES (RESTful routes) ---
app.use('/api', apiRoutes);

module.exports = app;
