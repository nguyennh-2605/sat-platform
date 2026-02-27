require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client'); 

// Login
const { register, login, googleLogin } = require('./src/controllers/authController');

const app = express();
const prisma = new PrismaClient(); // Khởi tạo kết nối DB
const PORT = process.env.PORT || 5000;

// --- MIDDLEWARE ---
app.use(cors({
  origin: ["https://sat-platform-two.vercel.app", "http://localhost:5173"],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// --- ROUTES (Đường dẫn) ---

// Route xử lí đăng nhập
app.post('/api/register', register);
app.post('/api/login', login);
app.post('/api/auth/google-login', googleLogin);
// Route xử lí các pages
app.use("/api/challenge", require("./src/routes/challengeRoutes"));
app.use("/api/classes", require("./src/routes/classRoutes"));
app.use("/api/error-logs", require("./src/routes/errorLogRoutes"));
app.use("/api/results-analytics", require("./src/routes/analyticsRoutes"));
app.use("/api/tests", require("./src/routes/practiceTestRoute"));
app.use("/api/test", require('./src/routes/examRoomRoutes'));
app.use("/api/ai", require("./src/routes/aiRoutes"));

// --- KHỞI ĐỘNG SERVER ---
app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});